// Demo data for presentations: 8 student accounts (different courses and
// year levels) and 20 approved listings with photos (scripts/demo/images,
// credits in scripts/demo/CREDITS.md). Everything it creates is marked
// demo: true, so it can be removed again in one go.
//
//   node scripts/demo-data.js <service-account.json>            list what exists (no changes)
//   node scripts/demo-data.js <service-account.json> --create   create missing accounts + listings
//   node scripts/demo-data.js <service-account.json> --delete   remove all demo data
//
// The accounts are real logins (verified @slsu.edu.ph emails) so you can sign
// in as one to test chats; --create prints their shared password.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const requireFromFunctions = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp, cert } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = requireFromFunctions('firebase-admin/firestore');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getStorage } = requireFromFunctions('firebase-admin/storage');

const [keyPath, mode] = process.argv.slice(2);
if (!keyPath) {
  console.error('Usage: node scripts/demo-data.js <service-account.json> [--create | --delete]');
  process.exit(1);
}
const BUCKET = 'gumacartfinal.firebasestorage.app';
initializeApp({ credential: cert(require(path.resolve(keyPath))), storageBucket: BUCKET });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();
const IMAGES = path.join(__dirname, 'demo/images');

const USERS = [
  { key: 'andrea', name: 'Andrea Villanueva', course: 'BSN', year: 2, age: 19, address: 'Brgy. San Diego | Gumaca' },
  { key: 'mark', name: 'Mark Joseph Dela Cruz', course: 'BIT-CPT', year: 3, age: 21, address: 'Brgy. Peñafrancia | Gumaca' },
  { key: 'kristine', name: 'Kristine Mae Ramos', course: 'BSBA-HRM', year: 4, age: 22, address: 'Brgy. Mabini | Lopez' },
  { key: 'johnpaul', name: 'John Paul Mendoza', course: 'BSED-MATH', year: 1, age: 18, address: 'Brgy. Villa Bota | Gumaca' },
  { key: 'patricia', name: 'Patricia Anne Santos', course: 'BSED-SS', year: 3, age: 20, address: 'Brgy. Bamban | Plaridel' },
  { key: 'carlo', name: 'Carlo Miguel Reyes', course: 'BIT-CPT', year: 1, age: 18, address: 'Brgy. Tabing Dagat | Gumaca' },
  { key: 'jasmine', name: 'Jasmine Nicole Bautista', course: 'BSBA-HRM', year: 2, age: 19, address: 'Brgy. Rosario | Atimonan' },
  { key: 'rhea', name: 'Rhea Joy Castillo', course: 'BSN', year: 4, age: 22, address: 'Brgy. Bagong Silang | Gumaca' },
];
const emailOf = (key) => `gumacart.demo.${key}@slsu.edu.ph`;

// [owner, type, title, description, price, quantity, category, condition, meet-up, photos, days ago]
const LISTINGS = [
  ['johnpaul', 'sell', 'Casio fx-991ES Plus Scientific Calculator', 'Used for one sem only, all functions working. Perfect for Math and Engineering subjects. With cover.', 650, 1, 'Electronics', 'Like New', 'Library', ['calculator-1', 'calculator-2'], 1],
  ['rhea', 'sell', 'Stethoscope (dual head)', 'Graduating na po, selling my stethoscope. Clear sound, complete earpieces.', 1200, 1, 'Personal Belongings', 'Good', 'Admin Office', ['stethoscope-1', 'stethoscope-2'], 3],
  ['mark', 'sell', 'Arduino Uno Board + Jumper Wires', 'Used for our IoT project. Board works perfectly, includes USB cable and 20 jumper wires.', 750, 1, 'Electronics', 'Good', 'Main Gate', ['arduino-1', 'arduino-2'], 2],
  ['mark', 'sell', 'Lenovo ThinkPad Laptop (Core i5, 8GB RAM)', 'Good for coding, documents and online classes. Battery lasts around 3 hours. With charger.', 8500, 1, 'Electronics', 'Good', 'Library', ['laptop-1', 'laptop-2'], 6],
  ['carlo', 'sell', 'Wireless Mouse (brand new)', 'Brand new, 2.4GHz receiver included. Got extras from a bundle.', 250, 3, 'Electronics', 'New', 'Main Gate', ['mouse-1'], 0.1],
  ['jasmine', 'sell', 'Homemade Leche Flan (per llanera)', 'Creamy and not too sweet. Order a day ahead, pickup at the dorm.', 120, 10, 'Food & Drinks', 'New', 'Dormitory', ['lecheflan-1', 'lecheflan-2'], 1],
  ['kristine', 'sell', 'Banana Cue (3 sticks)', 'Freshly cooked every afternoon. Message me to reserve.', 30, 20, 'Food & Drinks', 'New', 'Main Gate', ['bananacue-1'], 0.3],
  ['kristine', 'sell', 'Accounting Textbook (Fundamentals)', 'Complete pages, a few highlights. Good for BSBA first years.', 350, 1, 'Academic', 'Good', 'Library', ['accounting-1'], 5],
  ['patricia', 'sell', 'Crochet Keychains (made to order)', 'Handmade crochet keychains, choose your color. ₱45 each.', 45, 12, 'Crafts & Handmade', 'New', 'Library', ['crochet-1', 'crochet-2'], 4],
  ['andrea', 'buy', 'Looking for: Anatomy & Physiology Book', 'Any edition is okay basta complete. Willing to meet at the library.', 500, 1, 'Academic', 'Good', 'Library', ['anatomy-1'], 2],
  ['carlo', 'buy', 'Looking for: HDMI Cable (at least 1.5m)', 'For our class presentation. Pwede used basta working.', 150, 1, 'Electronics', 'Good', 'Main Gate', ['hdmi-1'], 1],
  ['patricia', 'barter', 'Acoustic Guitar, swap for a keyboard', 'Barely used, good sound. Looking to swap for a 61-key keyboard (piano).', 0, 1, 'Others', 'Like New', 'Admin Office', ['guitar-1', 'guitar-2'], 7],
  ['carlo', 'barter', 'Sneakers size 9, swap for size 8', 'Wrong size bought online, worn twice. Swap for the same style in size 8.', 0, 1, 'Clothes & Fashion', 'Like New', 'Dormitory', ['sneakers-1'], 3],
  ['rhea', 'donate', 'Free: Nursing Reviewers & Notes', 'Graduating na po! Giving away my reviewers and handouts for NCM subjects. Para sa juniors.', 0, 1, 'Academic', 'Fair', 'Library', ['reviewers-1'], 2],
  ['kristine', 'donate', 'Free: Snake Plant in Pot', 'Easy to care for, good for dorm rooms. I have 3 to give away.', 0, 3, 'Others', 'Good', 'Dormitory', ['snakeplant-1'], 4],
  ['mark', 'sell', 'Mechanical Keyboard (RGB, blue switches)', 'Clicky and satisfying to type on. Complete keys, with USB cable. Upgraded kaya binebenta.', 1500, 1, 'Electronics', 'Like New', 'Library', ['keyboard-1', 'keyboard-2'], 2],
  ['jasmine', 'sell', 'Chocolate Chip Cookies (pack of 6)', 'Soft-baked, chewy inside. Baked fresh every Monday and Thursday.', 60, 15, 'Food & Drinks', 'New', 'Dormitory', ['cookies-1', 'cookies-2'], 0.5],
  ['mark', 'sell', 'Phone Repair & Reformat Service', 'Software reformat, app install, screen protector install and basic repairs. Message me for the price of parts.', 150, 1, 'Services', 'New', 'Main Gate', ['phonerepair-1', 'phonerepair-2'], 3],
  ['johnpaul', 'sell', 'Math Tutoring: College Algebra (per hour)', 'Struggling with algebra? One-on-one tutoring after class, at the library. Bring your notes!', 100, 1, 'Services', 'New', 'Library', ['tutoring-1'], 5],
  ['andrea', 'sell', 'Digital BP Monitor', 'Automatic blood pressure monitor, accurate and easy to use. Good for RLE practice. With batteries.', 900, 1, 'Personal Belongings', 'Good', 'Admin Office', ['bp-1', 'bp-2'], 1],
];

// Upload a photo the way the app does: a Storage file with a download token.
async function upload(uid, name) {
  const dest = `listings/${uid}/demo-${name}.jpg`;
  const token = crypto.randomUUID();
  await bucket.file(dest).save(fs.readFileSync(path.join(IMAGES, `${name}.jpg`)), {
    metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
}

async function demoUsers() {
  return (await db.collection('users').where('demo', '==', true).get()).docs;
}

// Creates whatever is missing: running it again after adding entries above
// only adds the new accounts and listings.
async function create() {
  const existing = new Map((await demoUsers()).map((d) => [d.data().email, d.id]));
  const titles = new Set((await db.collection('listings').where('demo', '==', true).get()).docs.map((d) => d.data().title));
  const password = `Demo-${crypto.randomBytes(4).toString('hex')}`;
  let newUsers = 0, newListings = 0;
  const uids = {};
  for (const u of USERS) {
    if (existing.has(emailOf(u.key))) { uids[u.key] = existing.get(emailOf(u.key)); continue; }
    newUsers++;
    const user = await auth.createUser({ email: emailOf(u.key), password, displayName: u.name, emailVerified: true });
    uids[u.key] = user.uid;
    await db.collection('users').doc(user.uid).set({
      uid: user.uid, name: u.name, email: emailOf(u.key), address: u.address, age: u.age,
      role: 'student', facultyRequest: 'none', course: u.course, yearLevel: u.year,
      verificationStatus: 'verified', createdAt: FieldValue.serverTimestamp(), demo: true,
    });
    console.log(`  user  ${u.name} (${u.course}, year ${u.year})`);
  }
  const now = Date.now();
  for (const [owner, type, title, description, price, quantity, category, condition, location, photos, daysAgo] of LISTINGS) {
    if (titles.has(title)) continue;
    newListings++;
    const uid = uids[owner];
    const images = [];
    for (const p of photos) images.push(await upload(uid, p));
    const when = Timestamp.fromMillis(now - daysAgo * 86400000);
    await db.collection('listings').add({
      type, title, name: title, description, price, quantity, category, condition, location,
      image: images[0], images, videos: [],
      sellerId: uid, sellerName: USERS.find((u) => u.key === owner).name, sellerPhoto: null,
      status: 'active', createdAt: when, approvedAt: when, listedAt: when,
      viewCount: 5 + Math.floor(Math.random() * 60), saveCount: 0, alertsSent: true, demo: true,
    });
    console.log(`  listing  [${type}] ${title}`);
  }
  console.log(`\nCreated ${newUsers} account(s) and ${newListings} listing(s).`);
  if (newUsers) {
    console.log(`Log in as any of them with  ${emailOf('<name>')}  e.g. ${emailOf('andrea')}`);
    console.log(`Password for the new demo accounts: ${password}`);
  }
}

async function remove() {
  const users = await demoUsers();
  for (const u of users) {
    const uid = u.id;
    const listings = await db.collection('listings').where('sellerId', '==', uid).get();
    for (const l of listings.docs) await l.ref.delete();
    await bucket.deleteFiles({ prefix: `listings/${uid}/` }).catch(() => {});
    await u.ref.delete();
    await auth.deleteUser(uid).catch(() => {});
    console.log(`  removed ${u.data().name} and ${listings.size} listing(s)`);
  }
  console.log(`Removed ${users.length} demo account(s).`);
}

async function list() {
  const users = await demoUsers();
  for (const u of users) {
    const n = (await db.collection('listings').where('sellerId', '==', u.id).get()).size;
    console.log(`  ${u.data().name} (${u.data().course}, year ${u.data().yearLevel}): ${n} listing(s)`);
  }
  console.log(`${users.length} demo account(s). Use --create or --delete.`);
}

(mode === '--create' ? create() : mode === '--delete' ? remove() : list()).catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
