import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// "Usually replies within …", from replyStats/{uid} (kept by the server: how
// many replies and their total time). Shown once there are 3+ replies.
const cache = new Map();

function label({ replies, totalMs }) {
  if (!replies || replies < 3) return null;
  const avgMin = totalMs / replies / 60000;
  if (avgMin < 15) return 'Usually replies within minutes';
  if (avgMin < 60) return 'Usually replies within an hour';
  if (avgMin < 6 * 60) return 'Usually replies within a few hours';
  if (avgMin < 24 * 60) return 'Usually replies within a day';
  return 'Usually replies in a day or more';
}

export function useReplyTime(uid) {
  const [text, setText] = useState(cache.get(uid) ?? null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    if (!cache.has(uid)) {
      cache.set(uid, getDoc(doc(db, 'replyStats', uid))
        .then((snap) => label(snap.data() || {}))
        .catch(() => { cache.delete(uid); return null; }));
    }
    Promise.resolve(cache.get(uid)).then((t) => { if (alive) setText(t); });
    return () => { alive = false; };
  }, [uid]);
  return typeof text === 'string' ? text : null;
}
