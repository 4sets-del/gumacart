import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Listings expire 30 days after going live (see expireListings in functions).
// Renewing puts one back on the marketplace as if just posted, so it also
// moves to the top of "All Listings". No new admin review is needed.
export const LISTING_LIFETIME_DAYS = 30;

export function renewListing(listingId) {
  return updateDoc(doc(db, 'listings', listingId), {
    status: 'active',
    createdAt: serverTimestamp(),
    listedAt: serverTimestamp(),
    renewedAt: serverTimestamp(),
    expiryWarned: false,
  });
}
