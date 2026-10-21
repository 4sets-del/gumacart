import { COLORS } from './theme';

// The marketplace categories. `name` is what gets stored on listing docs.
export const CATEGORIES = [
  { name: 'Food & Drinks',       emoji: '🥗', tint: '#FFF1E0', color: '#EA580C' },
  { name: 'Clothes & Fashion',   emoji: '👕', tint: '#E6F0FA', color: '#2563EB' },
  { name: 'Academic',            emoji: '📚', tint: '#E8F4EC', color: '#16A34A' },
  { name: 'Electronics',         emoji: '💻', tint: '#EEE9FA', color: '#7C3AED' },
  { name: 'Personal Belongings', emoji: '🎒', tint: '#FDECEC', color: '#E11D48' },
  { name: 'Crafts & Handmade',   emoji: '🎨', tint: '#FFF6D9', color: '#CA8A04' },
  { name: 'Services',            emoji: '🔧', tint: '#E3F4F4', color: '#0D9488' },
  { name: 'Others',              emoji: '📦', tint: '#F1F4F2', color: '#64748B' },
];

// Listings created before the category change still carry the old names.
const LEGACY_CATEGORIES = {
  Clothing: 'Clothes & Fashion',
  Books: 'Academic',
  Furniture: 'Others',
  Sports: 'Others',
};

export function normalizeCategory(category) {
  if (!category) return '';
  return LEGACY_CATEGORIES[category] || category;
}

export function categoryMeta(category) {
  const name = normalizeCategory(category);
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}

export const LISTING_TYPES = {
  sell:   { label: 'For Sale', badge: null,     color: COLORS.sell,   bg: COLORS.sellBg },
  buy:    { label: 'Wanted',   badge: 'WANTED', color: COLORS.buy,    bg: COLORS.buyBg },
  barter: { label: 'Barter',   badge: 'BARTER', color: COLORS.barter, bg: COLORS.barterBg },
  donate: { label: 'Free',     badge: 'FREE',   color: COLORS.donate, bg: COLORS.donateBg },
};

export function typeMeta(type) {
  return LISTING_TYPES[type] || LISTING_TYPES.sell;
}

export function listingImage(item) {
  return item?.images?.[0] || item?.image || null;
}

export function listingTitle(item) {
  return item?.name || item?.title || 'Untitled';
}

// Text + color for the price line of a listing card.
export function priceLabel(item) {
  if (item.type === 'donate') return { text: 'FREE', color: COLORS.donate };
  if (item.type === 'barter') return { text: 'For Barter', color: COLORS.barter };
  if (item.type === 'buy') {
    return item.price
      ? { text: `Budget ₱${Number(item.price).toLocaleString()}`, color: COLORS.buy }
      : { text: 'Looking For', color: COLORS.buy };
  }
  return { text: item.price != null ? `₱${Number(item.price).toLocaleString()}` : '₱—', color: COLORS.primary };
}
