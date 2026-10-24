import { useSyncExternalStore } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';

// Blocking: users/{uid}/blocked/{otherUid}. Blocking someone hides their
// listings from you, hides your chat with them, and stops either of you from
// sending messages in it. The blocked person isn't told; they just can't
// reply. One shared listener keeps every screen in sync (like the wishlist).

let blocked = [];          // [{ id, name, photoURL, blockedAt }]
let ids = new Set();
let snapshot = { blocked, ids };
let unsubscribe = null;
let currentUid = null;
const subscribers = new Set();

const notify = () => {
  snapshot = { blocked, ids };
  subscribers.forEach((fn) => fn());
};

function start(uid) {
  if (unsubscribe && uid === currentUid) return;
  unsubscribe?.();
  currentUid = uid;
  unsubscribe = onSnapshot(
    collection(db, 'users', uid, 'blocked'),
    (snap) => {
      blocked = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      ids = new Set(blocked.map((b) => b.id));
      notify();
    },
    () => { unsubscribe = null; },
  );
}

function stop() {
  unsubscribe?.();
  unsubscribe = null;
  currentUid = null;
  blocked = [];
  ids = new Set();
  notify();
}

onAuthStateChanged(auth, (user) => (user ? (subscribers.size ? start(user.uid) : null) : stop()));

function subscribe(fn) {
  subscribers.add(fn);
  const uid = auth.currentUser?.uid;
  if (uid) start(uid);
  return () => subscribers.delete(fn);
}

// { blocked: [...people I blocked], ids: Set of their uids }
export function useBlocked() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function isBlockedByMe(uid) {
  return ids.has(uid);
}

export async function blockUser({ id, name, photoURL }) {
  const me = auth.currentUser?.uid;
  if (!me || !id || id === me) return;
  await setDoc(doc(db, 'users', me, 'blocked', id), {
    name: name || 'User',
    photoURL: photoURL || null,
    blockedAt: serverTimestamp(),
  });
}

export async function unblockUser(id) {
  const me = auth.currentUser?.uid;
  if (!me || !id) return;
  await deleteDoc(doc(db, 'users', me, 'blocked', id));
}

// Whether the other person has blocked me (they can read only their own
// entry for me, so this is a single small read).
export async function hasBlockedMe(otherUid) {
  const me = auth.currentUser?.uid;
  if (!me || !otherUid) return false;
  try {
    return (await getDoc(doc(db, 'users', otherUid, 'blocked', me))).exists();
  } catch (e) {
    return false;
  }
}

// Before starting or continuing a chat: null if fine, otherwise a message
// explaining why not.
export async function messagingBlockedReason(otherUid, otherName = 'this person') {
  if (isBlockedByMe(otherUid)) return `You blocked ${otherName}. Unblock them to send messages.`;
  if (await hasBlockedMe(otherUid)) return `You can't message ${otherName}.`;
  return null;
}
