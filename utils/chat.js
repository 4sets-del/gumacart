import {
  doc, getDoc, setDoc, collection, addDoc, updateDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function conversationIdFor(uidA, uidB) {
  const ids = [uidA, uidB].sort();
  return `${ids[0]}_${ids[1]}`;
}

// Makes sure a conversation doc exists between the current user and another
// user, optionally sends a first message, and returns the conversation id.
export async function startConversation(currentUser, otherUserId, text) {
  const conversationId = conversationIdFor(currentUser.uid, otherUserId);
  const convoRef = doc(db, 'conversations', conversationId);
  const convoDoc = await getDoc(convoRef);
  if (!convoDoc.exists()) {
    await setDoc(convoRef, {
      participants: [currentUser.uid, otherUserId],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCount: { [currentUser.uid]: 0, [otherUserId]: 0 },
      createdAt: serverTimestamp(),
    });
  }
  if (text) {
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text,
      type: 'text',
      createdAt: serverTimestamp(),
    });
    await updateDoc(convoRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      [`unreadCount.${otherUserId}`]: increment(1),
    });
  }
  return conversationId;
}
