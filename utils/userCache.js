import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { normalizeCourse } from '../constants/school';

// Short-lived cache of other users' public profile basics, so lists like the
// Messages inbox doesn't re-download every profile each time.
// Seller ratings on cards and the Search "Sellers" tab read from here too,
// so each profile is downloaded once.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // uid -> { at, promise }
const EMPTY = { name: 'Unknown', photoURL: null, email: '', avgRating: 0, totalReviews: 0, verificationStatus: null, role: null, course: null, yearLevel: null };

export function getUserBasics(uid) {
  if (!uid) return Promise.resolve(EMPTY);
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = getDoc(doc(db, 'users', uid))
    .then((snap) => {
      const data = snap.exists() ? snap.data() : {};
      return {
        name: data.name || 'Unknown',
        photoURL: data.photoURL || null,
        email: data.email || '',
        avgRating: data.avgRating || 0,
        totalReviews: data.totalReviews || 0,
        verificationStatus: data.verificationStatus || null,
        role: data.role || null,
        course: normalizeCourse(data.course),
        yearLevel: data.yearLevel || null,
      };
    })
    .catch(() => {
      cache.delete(uid); // retry next time instead of caching the failure
      return EMPTY;
    });
  cache.set(uid, { at: Date.now(), promise });
  return promise;
}

// Basics for several users at once (e.g. the sellers of a list of listings),
// as { uid: basics }. Uses the same cache, so it rarely downloads anything.
export function useUserBasicsMap(uids) {
  const [map, setMap] = useState({});
  const key = [...new Set(uids.filter(Boolean))].sort().join(',');
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(key.split(',').map(async (id) => [id, await getUserBasics(id)])).then((entries) => {
      if (!cancelled) setMap(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [key]);
  return map;
}
