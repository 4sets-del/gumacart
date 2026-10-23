import { useSyncExternalStore } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { listingImage, listingTitle } from '../constants/listings';

// Saved items ("wishlist"): wishlists/{uid}/items/{listingId}. One shared
// listener for the signed-in user, so every heart icon in the app stays in
// sync without each card reading Firestore.

let items = [];             // saved entries, newest first
let ids = new Set();        // listing ids, for quick "is this saved?" checks
let snapshot = { items, ids };
let unsubscribe = null;
let currentUid = null;
const subscribers = new Set();

const notify = () => {
  snapshot = { items, ids };
  subscribers.forEach((fn) => fn());
};

function start(uid) {
  if (unsubscribe && uid === currentUid) return;
  unsubscribe?.();
  currentUid = uid;
  unsubscribe = onSnapshot(
    collection(db, 'wishlists', uid, 'items'),
    (snap) => {
      items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.savedAt?.toMillis?.() || Date.now()) - (a.savedAt?.toMillis?.() || Date.now()));
      ids = new Set(items.map((i) => i.id));
      notify();
    },
    () => { unsubscribe = null; },
  );
}

function stop() {
  unsubscribe?.();
  unsubscribe = null;
  currentUid = null;
  items = [];
  ids = new Set();
  notify();
}

// Follow sign-in / sign-out.
onAuthStateChanged(auth, (user) => (user ? (subscribers.size ? start(user.uid) : null) : stop()));

function subscribe(fn) {
  subscribers.add(fn);
  const uid = auth.currentUser?.uid;
  if (uid) start(uid);
  return () => subscribers.delete(fn);
}

export function useWishlist() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// Save or un-save a listing. A small copy of the listing is stored so the
// Saved screen can show it even before the listing itself loads.
export async function toggleSaved(listing) {
  const uid = auth.currentUser?.uid;
  if (!uid || !listing?.id) return;
  const ref = doc(db, 'wishlists', uid, 'items', listing.id);
  if (ids.has(listing.id)) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      listingId: listing.id,
      name: listingTitle(listing),
      price: listing.price || 0,
      type: listing.type || 'sell',
      image: listingImage(listing),
      sellerId: listing.sellerId || null,
      sellerName: listing.sellerName || '',
      savedAt: serverTimestamp(),
    });
  }
}
