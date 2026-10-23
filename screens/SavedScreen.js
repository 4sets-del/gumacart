import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenHeader from '../components/ScreenHeader';
import { ProductRow } from '../components/ProductCard';
import GradientButton from '../components/GradientButton';
import { useWishlist, toggleSaved } from '../utils/wishlist';
import { useActiveListings } from '../utils/useListings';
import { useSellerRatings } from '../utils/sellerRatings';
import { SPACING, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Items the user tapped ❤️ on. Live data comes from the active-listings store;
// items that were sold or removed since are shown greyed out.
export default function SavedScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const { items } = useWishlist();
  const { listings } = useActiveListings();

  const rows = useMemo(() => {
    const live = new Map(listings.map((l) => [l.id, l]));
    return items.map((saved) => {
      const listing = live.get(saved.id);
      return listing ? { ...listing, available: true } : { ...saved, id: saved.id, available: false };
    });
  }, [items, listings]);
  const ratings = useSellerRatings(rows.filter((r) => r.available));

  const open = useCallback((item) => {
    if (item.available) navigation.navigate('ProductDetail', { product: item });
    else navigation.navigate('ProductDetail', { id: item.id });
  }, [navigation]);

  return (
    <View style={styles.safe}>
      <ScreenHeader title="Saved" subtitle={items.length ? `${items.length} item${items.length !== 1 ? 's' : ''}` : null} onBack={() => navigation.goBack()} border />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={rows.length ? styles.list : styles.emptyWrap}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        renderItem={({ item }) => (
          <View style={!item.available && styles.unavailable}>
            <ProductRow
              item={item}
              rating={ratings[item.sellerId]}
              onPress={open}
              right={(
                <TouchableOpacity onPress={() => toggleSaved(item).catch(() => {})} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Remove from saved">
                  <Ionicons name="heart" size={22} color={COLORS.error} />
                </TouchableOpacity>
              )}
            >
              {!item.available ? <Text style={styles.unavailableText}>No longer available</Text> : null}
            </ProductRow>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="heart-outline" size={36} color={COLORS.error} /></View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>Tap the ♡ on any item to save it here for later.</Text>
            <GradientButton title="Browse items" icon="search" onPress={() => navigation.navigate('Main', { screen: 'Home' })} style={{ marginTop: 18, alignSelf: 'stretch' }} />
          </View>
        )}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.lg },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xl },
  unavailable: { opacity: 0.55 },
  unavailableText: { fontSize: 12, fontWeight: '700', color: COLORS.error },
  empty: { alignItems: 'center' },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
