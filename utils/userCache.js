import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Short-lived cache of other users' name and photo, so lists like the
// Messages inbox don't re-download every profile on each update.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // uid -> { at, promise }

export function getUserBasics(uid) {
  if (!uid) return Promise.resolve({ name: 'Unknown', photoURL: null });
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = getDoc(doc(db, 'users', uid))
    .then((snap) => {
      const data = snap.exists() ? snap.data() : {};
      return { name: data.name || 'Unknown', photoURL: data.photoURL || null };
    })
    .catch(() => {
      cache.delete(uid); // retry next time instead of caching the failure
      return { name: 'Unknown', photoURL: null };
    });
  cache.set(uid, { at: Date.now(), promise });
  return promise;
}
