import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RADIUS, SHADOWS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { listingImage, listingTitle, priceLabel, typeMeta } from '../constants/listings';

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

function Thumb({ item, style, emojiSize }) {
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
    </View>
  );
}

// Vertical card used in the Home "Featured" row and listing grids.
// `onPress` receives the item, so screens can pass one stable function.
export const ProductCard = React.memo(function ProductCard({ item, rating, onPress, width }) {
  const { styles } = useTheme(createStyles);
  const price = priceLabel(item);
  return (
    <TouchableOpacity style={[styles.card, width && { width }]} onPress={() => onPress?.(item)} activeOpacity={0.88}>
      <Thumb item={item} style={styles.cardThumb} emojiSize={40} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{listingTitle(item)}</Text>
        <Text style={[styles.cardPrice, { color: price.color }]} numberOfLines={1}>{price.text}</Text>
        <Rating rating={rating} />
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
        <Text style={[styles.rowPrice, { color: price.color }]}>{price.text}</Text>
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
  cardBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 3 },
  cardTitle: { fontSize: 12.5, fontWeight: '600', color: COLORS.textPrimary },
  cardPrice: { fontSize: 14, fontFamily: FONTS.heading },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 10, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  rowThumb: { width: 86, height: 86, borderRadius: RADIUS.md },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 19 },
  rowPrice: { fontSize: 15, fontFamily: FONTS.heading },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary },
  ratingCount: { color: COLORS.textMuted, fontWeight: '500' },
});
