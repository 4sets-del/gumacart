// Plays a demo student (from demo-data.js) during a live demo, so the app
// shows real chats and the server sends real push notifications.
//
//   node scripts/demo-chat.js <key.json> <demo> <you@slsu.edu.ph> <action> [args]
//
// <demo> is a demo student's short name: andrea, mark, kristine, johnpaul,
// patricia, carlo, jasmine, rhea. <you> is the account on the phone.
//
// Chat
//   online                     shows "Active now" for the demo student
//   say "text"                 types for 2 s, then sends the message
//   card "listing title"       sends an inquiry card about one of YOUR listings
//   photo <image.jpg>          sends a photo
//   seen                       marks your messages as Seen
//   react <emoji>              reacts to your latest message
// Deals and notifications
//   reserve "title"            reserves one of the demo student's listings for you
//   sold "title"               marks it sold to you (you get "How was your purchase?")
//   pricedrop "title" <price>  lowers its price (people who saved it are notified)
//   approve                    approves your newest pending listing ("Listing approved")
//   verify                     approves your student ID ("You're verified!")
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const requireFromFunctions = require('module').createRequire(path.join(__dirname, '../functions/package.json'));
const { initializeApp, cert } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getStorage } = requireFromFunctions('firebase-admin/storage');

const [keyPath, demo, youEmail, action, ...args] = process.argv.slice(2);
if (!action) {
  console.error('Usage: node scripts/demo-chat.js <key.json> <demo> <you@slsu.edu.ph> <action> [args]  (see the top of this file)');
  process.exit(1);
}
const BUCKET = 'gumacartfinal.firebasestorage.app';
initializeApp({ credential: cert(require(path.resolve(keyPath))), storageBucket: BUCKET });
const db = getFirestore();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const me = await getAuth().getUserByEmail(`gumacart.demo.${demo}@slsu.edu.ph`);
  const you = await getAuth().getUserByEmail(youEmail.trim().toLowerCase());
  const meName = me.displayName;
  const youName = you.displayName || 'you';
  const convId = [me.uid, you.uid].sort().join('_');
  const conv = db.collection('conversations').doc(convId);

  const ensureConv = async () => {
    if (!(await conv.get()).exists) {
      await conv.set({
        participants: [me.uid, you.uid], lastMessage: '', lastMessageTime: FieldValue.serverTimestamp(),
        unreadCount: { [me.uid]: 0, [you.uid]: 0 }, createdAt: FieldValue.serverTimestamp(),
      });
    }
  };
  const send = async (msg, preview) => {
    await ensureConv();
    await conv.collection('messages').add({ senderId: me.uid, senderName: meName, reactions: {}, ...msg, createdAt: FieldValue.serverTimestamp() });
    await conv.update({
      lastMessage: preview, lastMessageTime: FieldValue.serverTimestamp(),
      [`unreadCount.${you.uid}`]: FieldValue.increment(1), [`typing.${me.uid}`]: null,
    });
  };
  const online = () => db.collection('presence').doc(me.uid).set({ lastActiveAt: FieldValue.serverTimestamp() }, { merge: true });
  const typeFor = async (ms) => {
    await ensureConv();
    for (let t = 0; t < ms; t += 2500) { await conv.update({ [`typing.${me.uid}`]: FieldValue.serverTimestamp() }); await sleep(Math.min(2500, ms - t)); }
  };
  const myListing = async (title, owner = me.uid) => {
    const snap = await db.collection('listings').where('sellerId', '==', owner).get();
    const hit = snap.docs.find((d) => (d.data().name || '').toLowerCase().includes(String(title).toLowerCase()));
    if (!hit) throw new Error(`No listing matching "${title}"`);
    return hit;
  };

  switch (action) {
    case 'online': await online(); break;
    case 'say': await online(); await typeFor(2000); await send({ type: 'text', text: args[0] }, args[0]); break;
    case 'card': {
      const l = await myListing(args[0], you.uid);
      const d = l.data();
      const text = { buy: "Hi! I have what you're looking for.", barter: "Hi! I'd like to trade for this. Is it still available?", donate: "Hi! Is this still available? I'd love to have it." }[d.type] || 'Hi! Is this still available?';
      await l.ref.collection('interested').doc(me.uid).set({ uid: me.uid, name: meName, at: FieldValue.serverTimestamp() }, { merge: true });
      await send({ type: 'listing', text, listingId: l.id, listingName: d.name, listingPrice: d.price ? `₱${Number(d.price).toLocaleString()}` : '', listingImage: (d.images || [])[0] || d.image || null, listingType: d.type || 'sell' }, `🛍️ Interested in "${d.name}"`);
      break;
    }
    case 'photo': {
      await ensureConv();
      const dest = `chats/${convId}/${Date.now()}.jpg`;
      const token = crypto.randomUUID();
      await getStorage().bucket().file(dest).save(fs.readFileSync(path.resolve(args[0])), { metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } } });
      const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
      await send({ type: 'image', text: '', mediaUrl: url }, '📷 Photo');
      break;
    }
    case 'seen': await ensureConv(); await conv.update({ [`lastReadAt.${me.uid}`]: FieldValue.serverTimestamp(), [`unreadCount.${me.uid}`]: 0 }); break;
    case 'react': {
      const snap = await conv.collection('messages').where('senderId', '==', you.uid).get();
      const last = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0))[0];
      if (!last) throw new Error('You have no messages in this chat yet');
      await last.ref.update({ [`reactions.${args[0] || '❤️'}`]: FieldValue.arrayUnion(me.uid) });
      break;
    }
    case 'reserve': { const l = await myListing(args[0]); await l.ref.update({ reserved: true, reservedFor: you.uid, reservedAt: FieldValue.serverTimestamp(), reserveReminderSent: false }); break; }
    case 'sold': { const l = await myListing(args[0]); await l.ref.update({ status: 'sold', soldTo: you.uid, soldAt: FieldValue.serverTimestamp(), reserved: false, reservedFor: null }); break; }
    case 'pricedrop': { const l = await myListing(args[0]); await l.ref.update({ price: Number(args[1]), updatedAt: FieldValue.serverTimestamp() }); break; }
    case 'approve': {
      const snap = await db.collection('listings').where('sellerId', '==', you.uid).where('status', '==', 'pending').get();
      const l = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0))[0];
      if (!l) throw new Error('No pending listing');
      await l.ref.update({ status: 'active', approvedAt: FieldValue.serverTimestamp(), ...(l.data().listedAt ? {} : { listedAt: FieldValue.serverTimestamp() }) });
      console.log(`Approved "${l.data().name}"`);
      break;
    }
    case 'verify': await db.collection('users').doc(you.uid).update({ verificationStatus: 'verified', 'verification.status': 'approved', 'verification.reviewedAt': FieldValue.serverTimestamp() }); break;
    default: throw new Error(`Unknown action "${action}"`);
  }
  console.log(`${meName} → ${youName}: ${action} done`);
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
