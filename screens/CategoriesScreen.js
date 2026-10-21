import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { CATEGORIES, normalizeCategory } from '../constants/listings';
import { useActiveListings } from '../utils/useListings';

const { width: SCREEN_W } = Dimensions.get('window');
const GAP = 14;
const CARD_W = (SCREEN_W - SPACING.lg * 2 - GAP) / 2;

export default function CategoriesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { listings } = useActiveListings({ includeOwn: true });

  const counts = listings.reduce((acc, l) => {
    const c = normalizeCategory(l.category);
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {isFocused && <StatusBar barStyle="dark-content" />}

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Categories</Text>
          <Text style={styles.headerSub}>What are you looking for today?</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search" style={styles.iconBtn} onPress={() => navigation.navigate('Search')}>
          <Ionicons name="search" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {CATEGORIES.map((cat) => {
          const count = counts[cat.name] || 0;
          return (
            <TouchableOpacity
              key={cat.name}
              style={[styles.card, { backgroundColor: cat.tint, borderColor: cat.color + '33' }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Search', { category: cat.name })}
            >
              <View style={[styles.cardGlow, { backgroundColor: cat.color + '14' }]} />
              <View style={[styles.iconTile, { shadowColor: cat.color }]}>
                <Text style={styles.emoji}>{cat.emoji}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>{cat.name}</Text>
              <View style={[styles.countPill, { backgroundColor: cat.color }]}>
                <Text style={styles.count}>{count} item{count !== 1 ? 's' : ''}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { fontSize: 24, fontFamily: FONTS.heading, color: COLORS.textPrimary, letterSpacing: -0.4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  card: { width: CARD_W, alignItems: 'center', paddingVertical: 20, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  cardGlow: { position: 'absolute', right: -30, top: -30, width: 100, height: 100, borderRadius: 50 },
  iconTile: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 3, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  emoji: { fontSize: 32 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  countPill: { marginTop: 8, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  count: { fontSize: 11.5, color: '#fff', fontWeight: '700' },
});
