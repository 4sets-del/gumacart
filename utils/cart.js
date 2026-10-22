import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { listingImage, listingTitle } from '../constants/listings';
import { markInterested } from './interest';

export async function addToCart(uid, listing) {
  await setDoc(doc(db, 'users', uid, 'cart', listing.id), {
    listingId: listing.id,
    name: listingTitle(listing),
    price: listing.price || 0,
    type: listing.type || 'sell',
    location: listing.location || '',
    image: listingImage(listing),
    sellerId: listing.sellerId || null,
    sellerName: listing.sellerName || '',
    quantity: 1,
    addedAt: serverTimestamp(),
  });
  markInterested(listing);
}

export async function removeFromCart(uid, listingId) {
  await deleteDoc(doc(db, 'users', uid, 'cart', listingId));
}
