import { useMemo, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebaseConfig';
import { useBlocked } from './blocking';
import { listedMs } from '../constants/listings';

// One shared Firestore listener for active listings, used by every screen
// (Home, Categories, Search...). Before, each screen opened its own listener
// on the whole collection, including pending/rejected/sold listings.
//
// The query only filters on `status`, which Firestore indexes automatically,
// so no composite index is needed; sorting by date happens here instead.

let cache = null;          // latest sorted array of active listings
const byId = new Map();    // listing id -> object, reused while unchanged
let loaded = false;
// Snapshot handed to React; replaced (never mutated) whenever data changes.
let snapshot = { cache: null, loaded: false };
const notify = () => {
  snapshot = { cache, loaded };
  subscribers.forEach((fn) => fn());
};
let unsubscribe = null;
let stopTimer = null;
const subscribers = new Set();

// Pending server timestamps count as "now"; listings restored from the
// on-phone copy carry a plain createdAtMs number instead.
const millis = (item) => listedMs(item) || Date.now();

// The newest listings are also saved on the phone so Home can show them
// instantly on the next launch while Firestore connects.
const STORAGE_KEY = 'gumacart:lastListings';
const SAVED_COUNT = 60;

function saveToPhone(items) {
  const slim = items.slice(0, SAVED_COUNT).map(({ createdAt, listedAt, updatedAt, approvedAt, rejectedAt, ...rest }) => ({
    ...rest,
    createdAtMs: createdAt?.toMillis ? createdAt.toMillis() : null,
    listedAtMs: listedAt?.toMillis ? listedAt.toMillis() : null,
  }));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(slim)).catch(() => {});
}

// View and save counters change often; write the phone copy at most every
// few seconds instead of on every update.
let saveTimer = null;
function saveToPhoneSoon(items) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToPhone(items), 3000);
}

async function restoreFromPhone() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    // Only fill in if Firestore hasn't already answered.
    if (raw && !cache) {
      cache = JSON.parse(raw);
      notify();
    }
  } catch (e) {}
}

function start() {
  if (unsubscribe) return;
  if (!cache) restoreFromPhone();
  unsubscribe = onSnapshot(
    query(collection(db, 'listings'), where('status', '==', 'active')),
    (snap) => {
      // Apply only what changed: untouched listings keep the same object, so
      // memoized cards don't redraw when someone else's listing gets a view.
      if (!loaded) byId.clear();
      snap.docChanges().forEach((c) => {
        if (c.type === 'removed') byId.delete(c.doc.id);
        else byId.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
      });
      cache = [...byId.values()].sort((a, b) => millis(b) - millis(a));
      loaded = true;
      saveToPhoneSoon(cache);
      notify();
    },
    (e) => {
      console.log('Listings error:', e.message);
      // A failed listener is already closed; allow the next subscriber to retry.
      unsubscribe = null;
      loaded = true;
      notify();
    },
  );
}

function stop() {
  unsubscribe?.();
  unsubscribe = null;
  byId.clear();
  cache = null;
  loaded = false;
  snapshot = { cache: null, loaded: false };
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
const getSnapshot = () => snapshot;

export function useActiveListings({ includeOwn = false } = {}) {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const { ids: blockedIds } = useBlocked();

  // Same array between updates, so screens can memoize work based on it.
  // Listings from people you blocked are left out everywhere.
  const uid = auth.currentUser?.uid;
  const listings = useMemo(() => {
    const all = state.cache || [];
    return all.filter((item) => (includeOwn || item.sellerId !== uid) && !blockedIds.has(item.sellerId));
  }, [state.cache, includeOwn, uid, blockedIds]);
  return { listings, loading: !state.loaded };
}
