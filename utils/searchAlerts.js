import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// "Notify me" saved searches: users/{uid}/savedSearches/{id}. When a new
// listing goes live whose title/description contains every word of a saved
// search, the server (onListingStatusChange) sends that user a notification.

// Lowercase words of 2+ letters/digits, without duplicates. The server uses
// the same rule (keywordsOf in functions/index.js).
export function keywordsOf(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  return [...new Set(words)];
}

const idFor = (words) => words.slice().sort().join('_').slice(0, 120);

export function useSearchAlerts() {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(
      collection(db, 'users', uid, 'savedSearches'),
      (snap) => setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
  }, []);
  return alerts;
}

// The alert matching this search text, if the user already has one.
export function findAlert(alerts, text) {
  const words = keywordsOf(text);
  if (!words.length) return null;
  return alerts.find((a) => a.id === idFor(words)) || null;
}

export async function addAlert(text) {
  const uid = auth.currentUser?.uid;
  const keywords = keywordsOf(text);
  if (!uid || !keywords.length) return;
  await setDoc(doc(db, 'users', uid, 'savedSearches', idFor(keywords)), {
    term: text.trim(),
    keywords: keywords.slice(0, 10),
    createdAt: serverTimestamp(),
  });
}

export async function removeAlert(id) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(db, 'users', uid, 'savedSearches', id));
}
