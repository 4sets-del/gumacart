import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// "Active now": while the app is open, presence/{uid}.lastActiveAt is
// refreshed every couple of minutes. It lives in its own collection so these
// frequent writes don't touch the user profile (or its Cloud Functions).
const BEAT_MS = 2 * 60 * 1000;      // half the writes of once a minute
const ACTIVE_MS = 5 * 60 * 1000;    // "Active now" = seen in the last 5 minutes

export function usePresenceHeartbeat(uid) {
  useEffect(() => {
    if (!uid) return;
    let timer = null;
    const beat = () => setDoc(doc(db, 'presence', uid), { lastActiveAt: serverTimestamp() }, { merge: true }).catch(() => {});
    const start = () => { if (!timer) { beat(); timer = setInterval(beat, BEAT_MS); } };
    const stop = () => { clearInterval(timer); timer = null; };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [uid]);
}

function ago(ms) {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 60) return `Active ${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Active ${h}h ago`;
  return null; // older than a day: don't show
}

// { active: boolean, label: "Active now" | "Active 5m ago" | null }
export function usePresence(uid) {
  const [lastMs, setLastMs] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!uid || uid === auth.currentUser?.uid) return;
    return onSnapshot(doc(db, 'presence', uid), (snap) => setLastMs(snap.get('lastActiveAt')?.toMillis?.() || 0), () => {});
  }, [uid]);
  // Re-check every 30s so "Active now" turns into "Active 3m ago" on its own.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!lastMs) return { active: false, label: null };
  const active = Date.now() - lastMs < ACTIVE_MS;
  return { active, label: active ? 'Active now' : ago(lastMs) };
}
