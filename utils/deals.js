import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Sales records (deals/{id}) are written by the server when a seller marks an
// item sold to a buyer. A buyer can rate a seller only after such a sale.
export async function hasCompletedDealWith(sellerId) {
  const uid = auth.currentUser?.uid;
  if (!uid || !sellerId) return false;
  try {
    const snap = await getDocs(query(
      collection(db, 'deals'),
      where('buyerId', '==', uid),
      where('sellerId', '==', sellerId),
      limit(1),
    ));
    return !snap.empty;
  } catch (e) {
    return false;
  }
}
