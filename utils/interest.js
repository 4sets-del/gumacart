import { doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// People interested in a listing (they messaged the seller about it or
// saved it). Stored per listing so the seller can pick a buyer and
// the server can tell everyone when it's reserved, available again or sold.
export function markInterested(listing) {
  const user = auth.currentUser;
  if (!user || !listing?.id || !listing.sellerId || listing.sellerId === user.uid) return;
  setDoc(doc(db, 'listings', listing.id, 'interested', user.uid), {
    uid: user.uid,
    name: user.displayName || 'Someone',
    at: serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

// Most recently interested first.
export async function getInterested(listingId) {
  try {
    const snap = await getDocs(query(collection(db, 'listings', listingId, 'interested'), orderBy('at', 'desc')));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}
