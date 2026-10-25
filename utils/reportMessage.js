import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export const MESSAGE_REPORT_REASONS = ['Harassment or threats', 'Scam or fraud', 'Spam', 'Inappropriate content', 'Other'];

// How many messages before and after the reported one are attached, from both
// people, so admins can judge the tone of the whole exchange (e.g. friends
// joking vs. a real threat) instead of one message on its own.
const CONTEXT = 10;

const millis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

// A small, plain copy of a message for the report (no reactions etc.).
function snapshotOf(m, reportedId) {
  return {
    id: m.id,
    senderId: m.senderId || null,
    senderName: m.senderName || '',
    type: m.type || 'text',
    text: m.text || '',
    mediaUrl: m.mediaUrl || null,
    listingName: m.listingName || null,
    amount: m.amount ?? null,
    place: m.place || null,
    createdAtMs: millis(m.createdAt),
    reported: m.id === reportedId,
  };
}

// Files a report about one chat message. `messages` is what the chat has
// loaded (oldest first); the surrounding messages are saved with the report
// as they are right now, so later edits or deletions don't change the record.
export async function reportMessage({ message, messages, conversationId, otherUserName, reason }) {
  const me = auth.currentUser;
  const i = messages.findIndex((m) => m.id === message.id);
  const around = i >= 0 ? messages.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1) : [message];
  await addDoc(collection(db, 'reports'), {
    kind: 'message',
    reporterId: me.uid,
    reporterName: me.displayName || '',
    reportedUserId: message.senderId,
    reportedUserName: message.senderName || otherUserName || 'User',
    conversationId,
    messageId: message.id,
    message: snapshotOf(message, message.id),
    context: around.map((m) => snapshotOf(m, message.id)),
    reason,
    confirmedReal: true,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

// One-line summary of a message (used in previews and notifications).
export function messageSummary(m) {
  if (!m) return '';
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'video') return '🎥 Video';
  if (m.type === 'audio') return '🎤 Voice message';
  if (m.type === 'listing') return `🛍️ ${m.listingName || 'Listing'}`;
  if (m.type === 'offer') return `💸 Offer ₱${Number(m.amount || 0).toLocaleString()}`;
  if (m.type === 'meetup') return `📍 Meet-up at ${m.place || 'campus'}`;
  return m.text || '';
}
