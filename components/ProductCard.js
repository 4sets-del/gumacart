import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RADIUS, SHADOWS, FONTS, colorForName } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useWishlist, toggleSaved } from '../utils/wishlist';
import * as Haptics from 'expo-haptics';
import { listingImage, listingTitle, priceLabel, typeMeta, categoryMeta, shortTimeAgo, listedMs } from '../constants/listings';

function Rating({ rating, size = 11 }) {
  const { COLORS, styles } = useTheme(createStyles);
  if (!rating || !rating.avg) return null;
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={size} color={COLORS.star} />
      <Text style={styles.ratingText}>
        {rating.avg.toFixed(1)}
        {rating.count ? <Text style={styles.ratingCount}> ({rating.count})</Text> : null}
      </Text>
    </View>
  );
}

// Heart button to save / un-save a listing (kept in sync app-wide).
// `plain` is for light backgrounds (list rows); the default sits on photos.
export function SaveButton({ item, size = 16, style, plain = false }) {
  const { COLORS, styles } = useTheme(createStyles);
  const { ids } = useWishlist();
  const saved = ids.has(item.id);
  if (!item?.id || item.id === 'preview') return null;
  return (
    <TouchableOpacity
      style={style || styles.heart}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); toggleSaved(item).catch(() => {}); }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save item'}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size} color={saved ? COLORS.error : plain ? COLORS.textMuted : '#fff'} />
    </TouchableOpacity>
  );
}

function Thumb({ item, style, emojiSize, details = false }) {
  const { styles } = useTheme(createStyles);
  const img = listingImage(item);
  const reserved = item.reserved === true && item.status !== 'sold';
  const badge = reserved ? 'RESERVED' : typeMeta(item.type).badge;
  return (
    <View style={[styles.thumb, style]}>
      {img ? (
        <Image
          source={{ uri: img }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={img}
        />
      ) : (
        <Text style={{ fontSize: emojiSize }}>🛍️</Text>
      )}
      {badge && (
        <View style={[styles.badge, { backgroundColor: reserved ? '#D9822B' : typeMeta(item.type).color }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {details ? <SaveButton item={item} /> : null}
      {details && listedMs(item) ? (
        <View style={styles.agePill}><Text style={styles.agePillText}>{shortTimeAgo(listedMs(item))}</Text></View>
      ) : null}
      {details && item.condition ? (
        <View style={styles.conditionPill}><Text style={styles.conditionText}>{item.condition}</Text></View>
      ) : null}
    </View>
  );
}

// Vertical card used in the Home "Featured" row and listing grids.
// `onPress` receives the item, so screens can pass one stable function.
// Shows the item at a glance: photo with type / condition / age, title,
// price, category + meet-up spot, and who is selling it.
export const ProductCard = React.memo(function ProductCard({ item, rating, onPress, width }) {
  const { COLORS, styles } = useTheme(createStyles);
  const price = priceLabel(item);
  const cat = item.category ? categoryMeta(item.category) : null;
  const seller = (item.sellerName || 'Seller').split(' ')[0];
  return (
    <TouchableOpacity style={[styles.card, width && { width }]} onPress={() => onPress?.(item)} activeOpacity={0.88}>
      <Thumb item={item} style={styles.cardThumb} emojiSize={40} details />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{listingTitle(item)}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.cardPrice, { color: price.color }]} numberOfLines={1}>{price.text}</Text>
          {item.quantity > 1 && item.status !== 'sold' ? <Text style={styles.stockText}>×{item.quantity}</Text> : null}
        </View>
        {cat || item.location ? (
          <View style={styles.metaRow}>
            {cat ? <Text style={styles.metaEmoji}>{cat.emoji}</Text> : null}
            {item.location ? (
              <>
                <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
              </>
            ) : (
              <Text style={styles.metaText} numberOfLines={1}>{cat.name}</Text>
            )}
          </View>
        ) : null}
        <View style={styles.sellerRow}>
          {item.sellerPhoto ? (
            <Image source={{ uri: item.sellerPhoto }} style={styles.sellerAvatar} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.sellerAvatar, { backgroundColor: colorForName(item.sellerName || '') }]}>
              <Text style={styles.sellerInitial}>{seller[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.sellerName} numberOfLines={1}>{seller}</Text>
          {rating?.avg ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={10} color={COLORS.star} />
              <Text style={styles.ratingText}>{rating.avg.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Horizontal row used in search results and My Listings.
export const ProductRow = React.memo(function ProductRow({ item, rating, onPress, right, children }) {
  const { styles } = useTheme(createStyles);
  const price = priceLabel(item);
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress?.(item)} activeOpacity={0.88}>
      <Thumb item={item} style={styles.rowThumb} emojiSize={30} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>{listingTitle(item)}</Text>
        <Text style={[styles.rowPrice, { color: price.color }]} numberOfLines={1}>{price.text}</Text>
        <Rating rating={rating} size={12} />
        {children}
      </View>
      {right}
    </TouchableOpacity>
  );
});

const createStyles = (COLORS) => StyleSheet.create({
  thumb: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', top: 6, left: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: FONTS.heading, letterSpacing: 0.3 },

  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
  cardThumb: { width: '100%', aspectRatio: 1.1 },
  cardBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 4 },
  cardTitle: { fontSize: 12.5, lineHeight: 16, minHeight: 32, fontWeight: '600', color: COLORS.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stockText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  cardPrice: { flexShrink: 1, fontSize: 14, fontFamily: FONTS.heading },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaEmoji: { fontSize: 11, marginRight: 2 },
  metaText: { flex: 1, fontSize: 11, color: COLORS.textMuted },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  sellerAvatar: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { color: '#fff', fontSize: 8.5, fontWeight: '800' },
  sellerName: { flex: 1, fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  heart: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  agePill: { position: 'absolute', bottom: 6, right: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.5)' },
  agePillText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
  conditionPill: { position: 'absolute', left: 6, bottom: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.92)' },
  conditionText: { color: '#1A1D1B', fontSize: 9.5, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 10, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  rowThumb: { width: 86, height: 86, borderRadius: RADIUS.md },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 19 },
  rowPrice: { fontSize: 15, fontFamily: FONTS.heading },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary },
  ratingCount: { color: COLORS.textMuted, fontWeight: '500' },
});
