import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const ms = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

// Sales records (deals/{id}) are written by the server when a seller marks an
// item sold to a buyer. A buyer rates each purchase once: the review's id is
// the deal's id, so buying another item from the same seller can be rated
// separately.
//
// Returns the signed-in user's purchases from this seller, oldest first, and
// the ones not rated yet. Reviews from before ratings were per item have no
// dealId; each of those counts as rating one purchase (the oldest), so no
// purchase can be rated twice.
export async function purchasesFrom(sellerId) {
  const uid = auth.currentUser?.uid;
  if (!uid || !sellerId) return { purchases: [], unrated: [] };
  try {
    const [dealsSnap, reviewsSnap] = await Promise.all([
      getDocs(query(collection(db, 'deals'), where('buyerId', '==', uid), where('sellerId', '==', sellerId))),
      getDocs(query(collection(db, 'reviews'), where('sellerId', '==', sellerId), where('reviewerId', '==', uid))),
    ]);
    const purchases = dealsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
    const reviews = reviewsSnap.docs.map((d) => d.data());
    const rated = new Set(reviews.map((r) => r.dealId).filter(Boolean));
    const legacyReviews = reviews.filter((r) => !r.dealId).length;
    const unrated = purchases.filter((p) => !rated.has(p.id)).slice(legacyReviews);
    return { purchases, unrated };
  } catch (e) {
    return { purchases: [], unrated: [] };
  }
}
