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

// Popularity score used to rank Featured Listings:
//   rating points: the seller's average rating (0-5)
//   view points:   log2(views + 1), so 1 view ≈ 1, 31 views ≈ 5, 1000 views ≈ 10
// The log curve keeps a hugely viewed listing from burying well-rated ones.
export function popularityScore(listing, sellerRating) {
  const ratingPoints = sellerRating?.avg || 0;
  const viewPoints = Math.log2((listing.viewCount || 0) + 1);
  return ratingPoints + viewPoints;
}
