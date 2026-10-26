import { ACTIVE_THEME } from './theme';

// Colors are read from the active palette when each helper runs, so they
// follow light/dark mode.
const palette = () => ACTIVE_THEME.colors;

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

// Soft background for a category: the pastel tint in light mode, a faint
// wash of the category color in dark mode.
export function categoryTint(cat) {
  return palette().isDark ? `${cat.color}2E` : cat.tint;
}

export function categoryMeta(category) {
  const name = normalizeCategory(category);
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}

export const LISTING_TYPES = {
  sell:   { label: 'For Sale', badge: null },
  buy:    { label: 'Wanted',   badge: 'WANTED' },
  barter: { label: 'Barter',   badge: 'BARTER' },
  donate: { label: 'Free',     badge: 'FREE' },
};

// Label, badge text and colors for a listing type (sell/buy/barter/donate).
export function typeMeta(type) {
  const key = LISTING_TYPES[type] ? type : 'sell';
  const c = palette();
  return { ...LISTING_TYPES[key], color: c[key], bg: c[`${key}Bg`] };
}

export function listingImage(item) {
  return item?.images?.[0] || item?.image || null;
}

export function listingTitle(item) {
  return item?.name || item?.title || 'Untitled';
}

// Text + color for the price line of a listing card.
export function priceLabel(item) {
  if (item.type === 'donate') return { text: 'FREE', color: palette().donate };
  if (item.type === 'barter') return { text: 'For Barter', color: palette().barter };
  if (item.type === 'buy') {
    return item.price
      ? { text: `Budget ₱${Number(item.price).toLocaleString()}`, color: palette().buy }
      : { text: 'Looking For', color: palette().buy };
  }
  return { text: item.price != null ? `₱${Number(item.price).toLocaleString()}` : '₱—', color: palette().primary };
}

// Compact age for cards: "Just now", "5m", "3h", "2d", then a short date.
export function shortTimeAgo(date) {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Shared listing links are web links, so Messenger / Facebook make them
// tappable. On Android they open the app (App Links: hosting/.well-known);
// otherwise hosting/listing.html offers to open it.
export const SHARE_LINK_BASE = 'https://gumacartfinal.web.app';
export const listingShareUrl = (id) => `${SHARE_LINK_BASE}/listing/${id}`;
