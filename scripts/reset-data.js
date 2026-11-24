// Fresh start: deletes every old account and listing, keeping
//   - the demo data (anything marked demo: true, see demo-data.js), and
//   - the admin account(s): by default every account with role "admin", or
//     only the emails given with --keep.
// Also removes what belonged to the deleted accounts and old listings:
// chats, reviews, sale records, saved items, notifications, reports, appeals
// and their files. Feedback (Admin Panel → Insights) is left alone.
//
//   node scripts/reset-data.js <service-account.json>                      preview only (no changes)
//   node scripts/reset-data.js <service-account.json> --keep you@slsu.edu.ph   preview, keeping only that admin
//   node scripts/reset-data.js <service-account.json> [--keep ...] --apply     really delete
//
// There is no undo. Run the preview first and read it.
const path = require('path');
const requireFromFunctions = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp, cert } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getStorage } = requireFromFunctions('firebase-admin/storage');

const args = process.argv.slice(2);
const keyPath = args[0];
if (!keyPath || keyPath.startsWith('--')) {
  console.error('Usage: node scripts/reset-data.js <service-account.json> [--keep email ...] [--apply]');
  process.exit(1);
}
const APPLY = args.includes('--apply');
const keepEmails = [];
args.forEach((a, i) => { if (a === '--keep' && args[i + 1]) keepEmails.push(args[i + 1].trim().toLowerCase()); });

initializeApp({ credential: cert(require(path.resolve(keyPath))), storageBucket: 'gumacartfinal.firebasestorage.app' });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

const pathOf = (url) => { const m = /\/o\/([^?]+)/.exec(url || ''); return m ? decodeURIComponent(m[1]) : null; };
const delFiles = (urls) => Promise.all(urls.map(pathOf).filter(Boolean).map((p) => bucket.file(p).delete().catch(() => {})));
const delPrefix = (prefix) => bucket.deleteFiles({ prefix }).catch(() => {});

(async () => {
  // ── Who stays ──
  const userDocs = (await db.collection('users').get()).docs;
  const authUsers = [];
  let page;
  do { page = await auth.listUsers(1000, page?.pageToken); authUsers.push(...page.users); } while (page.pageToken);

  const profile = new Map(userDocs.map((d) => [d.id, d.data()]));
  const allUids = new Set([...profile.keys(), ...authUsers.map((u) => u.uid)]);
  const emailOf = (uid) => (profile.get(uid)?.email || authUsers.find((u) => u.uid === uid)?.email || '').toLowerCase();
  const keep = (uid) => {
    const p = profile.get(uid) || {};
    if (p.demo === true) return true;
    if (keepEmails.length) return keepEmails.includes(emailOf(uid));
    return p.role === 'admin';
  };
  const kept = [...allUids].filter(keep);
  const gone = new Set([...allUids].filter((uid) => !keep(uid)));
  const keptAdmins = kept.filter((uid) => profile.get(uid)?.demo !== true);

  console.log(`\nAccounts: ${allUids.size} total`);
  for (const uid of allUids) {
    const p = profile.get(uid) || {};
    console.log(`  ${keep(uid) ? 'KEEP  ' : 'DELETE'}  ${(p.name || '(no profile)').padEnd(28)} ${emailOf(uid).padEnd(36)} ${p.demo ? 'demo' : (p.role || '-')}`);
  }
  if (!keptAdmins.length) {
    console.error('\nStopped: no admin account would be kept. Pass --keep <your email>.');
    process.exit(1);
  }

  // ── What goes ──
  const listings = (await db.collection('listings').get()).docs.filter((d) => d.data().demo !== true);
  // Every existing chat is from before the reset (demo accounts have none), so all go.
  const convs = (await db.collection('conversations').get()).docs;
  const reviews = (await db.collection('reviews').get()).docs;
  const deals = (await db.collection('deals').get()).docs;
  const reports = (await db.collection('reports').get()).docs;
  const appeals = (await db.collection('appeals').get()).docs;

  console.log(`\nWill delete:`);
  console.log(`  ${gone.size} account(s) (login, profile, notifications, saved items, alerts, files)`);
  console.log(`  ${listings.length} old listing(s) and their photos/videos`);
  console.log(`  ${convs.length} chat(s), ${reviews.length} review(s), ${deals.length} sale record(s)`);
  console.log(`  ${reports.length} report(s), ${appeals.length} appeal(s)`);
  console.log(`Kept admin account(s) get their old notifications, saved items and ratings cleared.`);
  console.log(`Kept: ${kept.length} account(s) and ${(await db.collection('listings').where('demo', '==', true).get()).size} demo listing(s).`);

  if (!APPLY) {
    console.log('\nPreview only. Nothing was changed. Add --apply to delete.');
    return;
  }

  console.log('\nDeleting...');
  for (const l of listings) {
    const d = l.data();
    await delFiles([...(d.images || []), d.image, ...(d.videos || [])].filter(Boolean));
    await db.recursiveDelete(l.ref);
  }
  console.log(`  listings done`);
  for (const c of convs) { await delPrefix(`chats/${c.id}/`); await db.recursiveDelete(c.ref); }
  console.log(`  chats done`);
  for (const r of reviews) { await delFiles(r.data().photos || []); await r.ref.delete(); }
  for (const d of [...deals, ...appeals]) await d.ref.delete();
  for (const r of reports) await r.ref.delete();
  await delPrefix('reports/'); // report proof photos (all reports are gone)
  console.log(`  reviews, sale records, reports and appeals done`);

  for (const uid of gone) {
    await Promise.all(['profiles', 'listings', 'verifications', 'reviews'].map((p) => delPrefix(`${p}/${uid}/`)));
    await db.recursiveDelete(db.collection('users').doc(uid));
    await db.recursiveDelete(db.collection('wishlists').doc(uid));
    await db.collection('presence').doc(uid).delete().catch(() => {});
    await db.collection('replyStats').doc(uid).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
  }
  console.log(`  ${gone.size} account(s) done`);

  // Kept admins: clear what pointed at deleted things.
  for (const uid of keptAdmins) {
    const ref = db.collection('users').doc(uid);
    await db.recursiveDelete(ref.collection('notifications'));
    await db.recursiveDelete(ref.collection('blocked'));
    await db.recursiveDelete(db.collection('wishlists').doc(uid));
    await db.collection('replyStats').doc(uid).delete().catch(() => {});
    await ref.update({ avgRating: 0, totalReviews: 0 }).catch(() => {});
  }
  console.log('Done.');
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
