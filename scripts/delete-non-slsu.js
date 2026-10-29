// Deletes every account whose login email isn't @slsu.edu.ph (admins too).
// Deleting the login triggers onAccountDeleted (functions/index.js), which
// removes their profile, listings, reviews, saved items and uploaded photos.
//
//   node scripts/delete-non-slsu.js <service-account.json>            list only
//   node scripts/delete-non-slsu.js <service-account.json> --delete   delete them
//
// Without --delete nothing is changed.
const path = require('path');
// firebase-admin is installed for the Cloud Functions; load it from there.
const requireFromFunctions = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp, cert } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

// Same check as isSchoolEmail() in constants/school.js.
const SCHOOL_DOMAIN = 'slsu.edu.ph';
const isSchoolEmail = (email) => typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`);

const keyPath = process.argv[2];
const doDelete = process.argv.includes('--delete');
if (!keyPath) {
  console.error('Usage: node scripts/delete-non-slsu.js <service-account.json> [--delete]');
  process.exit(1);
}

initializeApp({ credential: cert(require(path.resolve(keyPath))) });

(async () => {
  const auth = getAuth();
  const db = getFirestore();

  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const targets = users.filter((u) => !isSchoolEmail(u.email));
  const rows = await Promise.all(targets.map(async (u) => {
    const profile = (await db.collection('users').doc(u.uid).get()).data() || {};
    return { email: u.email || '(no email)', name: profile.name || '(no profile)', role: profile.role || '-', uid: u.uid };
  }));

  console.log(`${users.length} accounts, ${users.length - targets.length} SLSU, ${targets.length} not SLSU:\n`);
  console.table(rows);
  const admins = rows.filter((r) => r.role === 'admin');
  if (admins.length) console.log(`\nIncludes ${admins.length} admin account(s): ${admins.map((a) => a.email).join(', ')}`);

  if (!doDelete) {
    console.log('\nNothing deleted. Run again with --delete to delete these accounts.');
    return;
  }

  let ok = 0;
  for (const r of rows) {
    try {
      await auth.deleteUser(r.uid);
      ok++;
      console.log(`Deleted ${r.email}`);
    } catch (e) {
      console.error(`Failed ${r.email}: ${e.message}`);
    }
  }
  console.log(`\nDeleted ${ok} of ${rows.length}. Their data is removed by onAccountDeleted over the next minute or so.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
