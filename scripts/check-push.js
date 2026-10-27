// Read-only check of who can get notifications with pictures:
//   - phones: Expo tokens (one per phone / install)
//   - direct: of those, paired with a Firebase token (current APK: direct
//             route with stacking + picture); the rest get Expo pushes
//   - photo: whether the profile has a photo (otherwise a letter picture is used)
//
//   node scripts/check-push.js <service-account.json>
//
// Nothing is changed. Tokens and emails are not printed.
const path = require('path');
// firebase-admin is installed for the Cloud Functions; load it from there.
const requireFromFunctions = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp, cert } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node scripts/check-push.js <service-account.json>');
  process.exit(1);
}

initializeApp({ credential: cert(require(path.resolve(keyPath))) });

(async () => {
  const snap = await getFirestore().collection('users').get();
  const rows = snap.docs.map((d) => {
    const u = d.data();
    return {
      name: u.name || '(no name)',
      photo: u.photoURL ? 'yes' : 'no',
      phones: Array.isArray(u.pushTokens) ? u.pushTokens.length : 0,
      direct: (u.pushTokens || []).filter((t) => (u.fcmFor || {})[t]).length,
    };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  console.table(rows);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
