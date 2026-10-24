// One-time cleanup: listings no longer collect or show phone numbers, but
// older listings still have `contactNumber` stored. This deletes that field.
//
//   node scripts/remove-phone-numbers.js <service-account.json>          dry run
//   node scripts/remove-phone-numbers.js <service-account.json> --apply  delete
//
// The service account key comes from Firebase console → Project settings →
// Service accounts. Keep it outside the project; never commit it.
const path = require('path');
// firebase-admin is installed for the Cloud Functions; load it from there.
const requireFromFunctions = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp, cert } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');

const [keyPath, flag] = process.argv.slice(2);
if (!keyPath) {
  console.error('Usage: node scripts/remove-phone-numbers.js <service-account.json> [--apply]');
  process.exit(1);
}
const apply = flag === '--apply';

initializeApp({ credential: cert(require(path.resolve(keyPath))) });
const db = getFirestore();

(async () => {
  const snap = await db.collection('listings').get();
  const withPhone = snap.docs.filter((d) => d.get('contactNumber') !== undefined);
  console.log(`${snap.size} listings checked, ${withPhone.length} still have a phone number stored.`);
  if (!apply) {
    console.log('Dry run: nothing changed. Add --apply to delete them.');
    return;
  }
  // Batches of up to 500 writes.
  for (let i = 0; i < withPhone.length; i += 500) {
    const batch = db.batch();
    withPhone.slice(i, i + 500).forEach((d) => batch.update(d.ref, { contactNumber: FieldValue.delete() }));
    await batch.commit();
  }
  const check = (await db.collection('listings').get()).docs.filter((d) => d.get('contactNumber') !== undefined).length;
  console.log(`Deleted. Listings still with a phone number: ${check}.`);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
