import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// One conversation per pair of people; its id is both uids, sorted.
export function conversationIdFor(uidA, uidB) {
  const ids = [uidA, uidB].sort();
  return `${ids[0]}_${ids[1]}`;
}

// Makes sure the conversation between the current user and another user
// exists, and returns its id. `extra` is stored only when it's created.
export async function ensureConversation(currentUser, otherUserId, extra = {}) {
  const conversationId = conversationIdFor(currentUser.uid, otherUserId);
  const convoRef = doc(db, 'conversations', conversationId);
  if (!(await getDoc(convoRef)).exists()) {
    await setDoc(convoRef, {
      participants: [currentUser.uid, otherUserId],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCount: { [currentUser.uid]: 0, [otherUserId]: 0 },
      createdAt: serverTimestamp(),
      ...extra,
    });
  }
  return conversationId;
}
