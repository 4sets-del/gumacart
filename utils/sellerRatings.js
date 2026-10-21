import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Listings don't carry their own rating, so cards show the seller's rating.
// Results are cached for the app session so each seller is fetched once.
const cache = {};

async function fetchRating(sellerId) {
  if (!cache[sellerId]) {
    cache[sellerId] = getDoc(doc(db, 'users', sellerId))
      .then((snap) => {
        const d = snap.data() || {};
        return { avg: d.avgRating || 0, count: d.totalReviews || 0 };
      })
      .catch(() => {
        delete cache[sellerId];
        return { avg: 0, count: 0 };
      });
  }
  return cache[sellerId];
}

export function useSellerRatings(listings) {
  const [ratings, setRatings] = useState({});
  const key = [...new Set(listings.map((l) => l.sellerId).filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(',');
    Promise.all(ids.map(async (id) => [id, await fetchRating(id)])).then((entries) => {
      if (!cancelled) setRatings(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [key]);

  return ratings;
}
