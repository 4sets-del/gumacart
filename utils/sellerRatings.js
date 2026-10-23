import { useEffect, useState } from 'react';
import { getUserBasics } from './userCache';

// Listings don't carry their own rating, so cards show the seller's rating.
// It comes from the shared profile cache (utils/userCache), so a seller whose
// name and photo were already loaded isn't downloaded again.
export function useSellerRatings(listings) {
  const [ratings, setRatings] = useState({});
  const key = [...new Set(listings.map((l) => l.sellerId).filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(',');
    Promise.all(ids.map(async (id) => {
      const u = await getUserBasics(id);
      return [id, { avg: u.avgRating || 0, count: u.totalReviews || 0 }];
    })).then((entries) => {
      if (!cancelled) setRatings(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [key]);

  return ratings;
}
