import { doc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Listings already counted during this app session, so reopening the same
// listing (or going back and forth) doesn't inflate its view count.
const viewedThisSession = new Set();

export function recordView(listing) {
  const uid = auth.currentUser?.uid;
  // Sellers don't count their own views; wait until we know who the seller is.
  if (!uid || !listing?.id || !listing.sellerId || listing.sellerId === uid) return;
  if (viewedThisSession.has(listing.id)) return;
  viewedThisSession.add(listing.id);
  updateDoc(doc(db, 'listings', listing.id), { viewCount: increment(1) }).catch(() => {
    // Not critical: allow a retry later in the session if this one failed.
    viewedThisSession.delete(listing.id);
  });
}
