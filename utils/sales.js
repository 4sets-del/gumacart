import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Mark one of my listings as sold to a buyer (same fields the product page
// writes): with several in stock, one unit is sold; otherwise the listing is
// sold. The server then invites the buyer to rate the seller and tells
// others who were interested.
export async function markSoldTo(listing, buyerId) {
  const stock = Math.max(1, Number(listing.quantity) || 1);
  if (stock > 1) {
    await updateDoc(doc(db, 'listings', listing.id), {
      quantity: stock - 1, lastSaleTo: buyerId, lastSaleAt: serverTimestamp(),
    });
    return { soldOut: false, left: stock - 1 };
  }
  await updateDoc(doc(db, 'listings', listing.id), {
    status: 'sold', soldTo: buyerId, soldAt: serverTimestamp(), reserved: false, reservedFor: null,
  });
  return { soldOut: true, left: 0 };
}
