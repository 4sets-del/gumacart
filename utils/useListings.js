import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebaseConfig';

// One shared Firestore listener for active listings, used by every screen
// (Home, Categories, Search...). Before, each screen opened its own listener
// on the whole collection, including pending/rejected/sold listings.
//
// The query only filters on `status`, which Firestore indexes automatically,
// so no composite index is needed; sorting by date happens here instead.

let cache = null;          // latest sorted array of active listings
let loaded = false;
let unsubscribe = null;
let stopTimer = null;
const subscribers = new Set();

// Pending server timestamps count as "now"; listings restored from the
// on-phone copy carry a plain createdAtMs number instead.
const millis = (item) => (item.createdAt?.toMillis ? item.createdAt.toMillis() : item.createdAtMs || Date.now());

// The newest listings are also saved on the phone so Home can show them
// instantly on the next launch while Firestore connects.
const STORAGE_KEY = 'gumacart:lastListings';
const SAVED_COUNT = 60;

function saveToPhone(items) {
  const slim = items.slice(0, SAVED_COUNT).map(({ createdAt, updatedAt, approvedAt, rejectedAt, ...rest }) => ({
    ...rest,
    createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : null,
  }));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(slim)).catch(() => {});
}

async function restoreFromPhone() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    // Only fill in if Firestore hasn't already answered.
    if (raw && !cache) {
      cache = JSON.parse(raw);
      subscribers.forEach((fn) => fn());
    }
  } catch (e) {}
}

function start() {
  if (unsubscribe) return;
  if (!cache) restoreFromPhone();
  unsubscribe = onSnapshot(
    query(collection(db, 'listings'), where('status', '==', 'active')),
    (snap) => {
      cache = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => millis(b) - millis(a));
      loaded = true;
      saveToPhone(cache);
      subscribers.forEach((fn) => fn());
    },
    (e) => {
      console.log('Listings error:', e.message);
      // A failed listener is already closed; allow the next subscriber to retry.
      unsubscribe = null;
      loaded = true;
      subscribers.forEach((fn) => fn());
    },
  );
}

function stop() {
  unsubscribe?.();
  unsubscribe = null;
  cache = null;
  loaded = false;
}

// Signing out ends access to listings, so drop the listener and cached data.
onAuthStateChanged(auth, (user) => {
  if (!user) {
    clearTimeout(stopTimer);
    stop();
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
});

function subscribe(fn) {
  clearTimeout(stopTimer);
  subscribers.add(fn);
  start();
  return () => {
    subscribers.delete(fn);
    // Keep the listener briefly so moving between screens doesn't re-download
    // everything; close it once nothing has used it for a while (e.g. logout).
    if (subscribers.size === 0) stopTimer = setTimeout(stop, 30000);
  };
}

// Live list of active marketplace listings, newest first. The current user's
// own listings are excluded unless `includeOwn` is set.
export function useActiveListings({ includeOwn = false } = {}) {
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);

  // Same array between updates, so screens can memoize work based on it.
  const uid = auth.currentUser?.uid;
  const listings = useMemo(() => {
    const all = cache || [];
    return includeOwn ? all : all.filter((item) => item.sellerId !== uid);
  }, [version, includeOwn, uid]);
  return { listings, loading: !loaded };
}
