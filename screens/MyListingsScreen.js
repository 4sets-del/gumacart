import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { ProductRow } from '../components/ProductCard';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import GradientButton from '../components/GradientButton';

const STATUS_PILLS = {
  active:   { label: 'Active',         color: COLORS.primary, bg: COLORS.primaryPale },
  pending:  { label: 'Pending review', color: COLORS.warning, bg: COLORS.warningLight },
  rejected: { label: 'Rejected',       color: COLORS.error,   bg: COLORS.errorLight },
  sold:     { label: 'Sold',           color: COLORS.textSecondary, bg: COLORS.surfaceAlt },
};

export default function MyListingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('active');
  const user = auth.currentUser;

  const loadListings = async () => {
    try {
      const q = query(collection(db, 'listings'), where('sellerId', '==', user.uid), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setListings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log('My listings error:', e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadListings();
    return navigation.addListener('focus', loadListings);
  }, [navigation]);

  const onRefresh = async () => { setRefreshing(true); await loadListings(); setRefreshing(false); };

  const activeListings = listings.filter((l) => l.status !== 'sold');
  const soldListings = listings.filter((l) => l.status === 'sold');
  const shown = tab === 'active' ? activeListings : soldListings;

  const openListing = (item) => (item.status === 'rejected'
    ? navigation.navigate('CreateListing', { editListing: item })
    : navigation.navigate('ProductDetail', { product: item }));

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Listings</Text>
      </View>

      <View style={styles.segment}>
        {[['active', `Active (${activeListings.length})`], ['sold', `Sold (${soldListings.length})`]].map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.segmentItem, tab === id && styles.segmentItemOn]} activeOpacity={0.85} onPress={() => setTab(id)}>
            <Text style={[styles.segmentText, tab === id && styles.segmentTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>{tab === 'active' ? 'No active listings' : 'No sold items yet'}</Text>
              {tab === 'active' && <Text style={styles.emptySub}>Post something to get started!</Text>}
            </View>
          }
          renderItem={({ item }) => {
            const pill = STATUS_PILLS[item.status] || STATUS_PILLS.active;
            return (
              <ProductRow
                item={item}
                onPress={() => openListing(item)}
                right={
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
                  </View>
                }
              >
                {item.status === 'rejected' && (
                  <Text style={styles.rejectText} numberOfLines={2}>
                    {item.rejectionReason ? `Reason: ${item.rejectionReason}. ` : ''}Tap to edit and re-submit.
                  </Text>
                )}
              </ProductRow>
            );
          }}
        />
      )}

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <GradientButton title="Add New Listing" icon="add-circle-outline" onPress={() => navigation.navigate('CreateListing')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginLeft: 4 },

  segment: { flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: RADIUS.full },
  segmentItemOn: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 13.5, fontWeight: '600', color: COLORS.textSecondary },
  segmentTextOn: { color: '#fff', fontWeight: '700' },

  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 20, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 10.5, fontWeight: '700' },
  rejectText: { fontSize: 11.5, color: COLORS.error, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 6 },
  emptySub: { fontSize: 13, color: COLORS.textMuted },

  footer: { paddingHorizontal: SPACING.lg, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  addBtn: { flexDirection: 'row', gap: 6, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
