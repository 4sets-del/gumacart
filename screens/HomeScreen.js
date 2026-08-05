import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  StatusBar,
  Image,
  Modal,
  Alert,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import WelcomeTutorial from '../components/WelcomeTutorial';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const ANDROID_TOP = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: '1', label: 'Clothing',    emoji: '👕' },
  { id: '2', label: 'Electronics', emoji: '💻' },
  { id: '3', label: 'Books',       emoji: '📚' },
  { id: '4', label: 'Furniture',   emoji: '🛋️' },
  { id: '5', label: 'Sports',      emoji: '⚽' },
  { id: '6', label: 'Others',      emoji: '📦' },
];

const LISTING_TYPES = [
  { id: 'sell',   label: 'For Sale',    icon: '🏷️', desc: 'Someone is selling this',  color: '#2E7D32', tint: '#E3F0E4' },
  { id: 'buy',    label: 'Looking For', icon: '🔍', desc: 'Someone wants to buy this', color: '#1565C0', tint: '#DCE9F7' },
  { id: 'barter', label: 'Barter',      icon: '🔄', desc: 'Trade for something',       color: '#E65100', tint: '#FBE8DA' },
  { id: 'donate', label: 'Donate',      icon: '🎁', desc: 'Free give away',            color: '#C62828', tint: '#F8E0E0' },
];

const TYPE_CONFIG = {
  sell:   { label: 'FOR SALE', bg: '#2E6B3E' },
  buy:    { label: 'WANTED',   bg: '#2980b9' },
  barter: { label: 'BARTER',   bg: '#e67e22' },
  donate: { label: 'FREE',     bg: '#e74c3c' },
};

const PRICE_CONFIG = {
  sell:   { color: '#2E6B3E' },
  buy:    { color: '#2980b9' },
  barter: { color: '#e67e22' },
  donate: { color: '#e74c3c' },
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function CategoryChip({ item, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.categoryChip, selected && styles.categoryChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, selected && styles.categoryIconActive]}>
        <Text style={styles.categoryEmoji}>{item.emoji}</Text>
        {selected && (
          <View style={styles.categoryCheck}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.categoryLabel, selected && styles.categoryLabelActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

function ListingCard({ item, onPress }) {
  const typeConf  = TYPE_CONFIG[item.type]  || TYPE_CONFIG.sell;
  const priceConf = PRICE_CONFIG[item.type] || PRICE_CONFIG.sell;

  const imgUrl = item.images?.[0] || item.image || null;

  const priceLabel = () => {
    if (item.type === 'sell'   && item.price) return `₱${item.price?.toLocaleString()}`;
    if (item.type === 'barter') return 'For Barter';
    if (item.type === 'donate') return 'FREE';
    if (item.type === 'buy')    return 'Looking For';
    return '';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Image area */}
      <View style={[styles.cardImageArea, { backgroundColor: typeConf.bg }]}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <Text style={styles.cardEmoji}>{item.emoji || '🛍️'}</Text>
        )}
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeConf.bg }]}>
          <Text style={styles.typeBadgeText}>{typeConf.label}</Text>
        </View>
      </View>

      {/* Card info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title || item.name}</Text>
        <Text style={[styles.cardPrice, { color: priceConf.color }]}>
          {priceLabel()}
        </Text>
        <View style={styles.cardLocation}>
          <Ionicons name="location-sharp" size={12} color={COLORS.textMuted} />
          <Text style={styles.cardLocationText}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  // Reads the phone's ACTUAL system nav bar height at runtime, so the app's
  // bottom nav sits above it on gesture-bar phones AND 3-button-nav phones.
  const insets = useSafeAreaInsets();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [listings, setListings]                 = useState([]);
  const [searchText, setSearchText]             = useState('');
  const [cartIds, setCartIds]                   = useState([]);
  const [refreshing, setRefreshing]             = useState(false);
  const [notifCount, setNotifCount]             = useState(0);
  const [unreadConvoCount, setUnreadConvoCount] = useState(0);

  // Filter modal state
  const [showFilterModal, setShowFilterModal]   = useState(false);
  const [selectedTypes, setSelectedTypes]       = useState([]);

  const user = auth.currentUser;

  // Show the welcome tutorial once, on first launch after verifying.
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    const checkWelcome = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data()?.hasSeenWelcome !== true) {
          setShowWelcome(true);
        }
      } catch (e) {}
    };
    checkWelcome();
  }, []);

  const dismissWelcome = async () => {
    setShowWelcome(false);
    try {
      await setDoc(doc(db, 'users', user.uid), { hasSeenWelcome: true }, { merge: true });
    } catch (e) {}
  };

  // ── Firestore: load listings ──
  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.sellerId !== user?.uid && item.status === 'active');
      setListings(items);
    }, (e) => console.log('Listings error:', e.message));
    return unsub;
  }, []);

  // ── Firestore: unread messages ──
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.docs.forEach((d) => {
        const unread = d.data().unreadCount?.[user.uid] || 0;
        if (unread > 0) count++;
      });
      setUnreadConvoCount(count);
    }, (e) => { if (e.code !== 'permission-denied') console.log(e.message); });
    return unsub;
  }, []);

  // ── Firestore: cart ──
  const loadCartIds = async () => {
    if (!user?.uid) return;
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'cart'));
      setCartIds(snap.docs.map((d) => d.id));
    } catch (e) {}
  };

  useEffect(() => { loadCartIds(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadCartIds);
    return unsub;
  }, [navigation]);

  // ── Firestore: unread notification count for the bell badge ──
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'notifications'),
      (snap) => {
        const unread = snap.docs.filter((d) => d.data().read === false).length;
        setNotifCount(unread > 9 ? '9+' : unread);
      },
      () => {}
    );
    return unsub;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCartIds();
    setRefreshing(false);
  };

  // ── Cart toggle ──
  const toggleType = (typeId) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId],
    );
  };

  const toggleCategory = (catLabel) => {
    setSelectedCategories((prev) =>
      prev.includes(catLabel) ? prev.filter((c) => c !== catLabel) : [...prev, catLabel],
    );
  };

  // ── Filtered listings ──
  const filtered = listings.filter((l) => {
    const matchCat    = selectedCategories.length === 0 || selectedCategories.includes(l.category);
    const matchType   = selectedTypes.length === 0 || selectedTypes.includes(l.type);
    const matchSearch = !searchText || (l.title || l.name || '').toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchType && matchSearch;
  });

  const sectionLabel = () => {
    if (searchText) return 'Results';
    if (selectedCategories.length > 0) return selectedCategories.join(' / ');
    if (selectedTypes.length > 0) return selectedTypes.map(t => LISTING_TYPES.find(l => l.id === t)?.label).join(' / ');
    return 'Latest Listings';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <WelcomeTutorial visible={showWelcome} onClose={dismissWelcome} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>🛒</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>SLSU-{'\n'}GumaCart</Text>
              <Text style={styles.headerSub}>Campus Marketplace</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications" size={22} color={COLORS.primary} />
              {notifCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{notifCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Cart')}>
              <Ionicons name="cart" size={22} color={COLORS.primary} />
              {cartIds.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartIds.length > 9 ? '9+' : cartIds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SEARCH BAR ── */}
        <TouchableOpacity
          style={styles.searchWrap}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={18} color="#8A9382" style={{ marginLeft: 6 }} />
          <Text style={styles.searchPlaceholder}>Search listings or sellers...</Text>
        </TouchableOpacity>

        {/* ── ACTIVE TYPE FILTER CHIPS ── */}
        {selectedTypes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersRow}>
            {selectedTypes.map((t) => {
              const type = LISTING_TYPES.find((lt) => lt.id === t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.activeChip, { backgroundColor: type?.color }]}
                  onPress={() => toggleType(t)}
                >
                  <Text style={styles.activeChipText}>{type?.icon} {type?.label} ✕</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.clearAllChip} onPress={() => setSelectedTypes([])}>
              <Text style={styles.clearAllChipText}>Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── CATEGORIES ── */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              item={cat}
              selected={selectedCategories.includes(cat.label)}
              onPress={() => toggleCategory(cat.label)}
            />
          ))}
        </ScrollView>

        {/* ── LISTINGS HEADER ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionLabel()}</Text>
          <Text style={styles.sectionCount}>{filtered.length} items</Text>
        </View>

        {/* ── 2-COLUMN GRID ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>📭</Text>
            </View>
            <Text style={styles.emptyText}>No listings found</Text>
            <Text style={styles.emptySub}>
              {listings.length === 0 ? 'Be the first to post something!' : 'Try a different filter'}
            </Text>
            {listings.length === 0 && (
              <TouchableOpacity style={styles.emptyPostBtn} activeOpacity={0.85} onPress={() => navigation.navigate('CreateListing')}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyPostBtnText}>Post a Listing</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((item) => (
              <View key={item.id} style={styles.gridItem}>
                <ListingCard
                  item={item}
                  onPress={() => navigation.navigate('ProductDetail', { product: item })}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── FILTER MODAL (slides up) ── */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filter by Type</Text>
                <Text style={styles.modalSubtitle}>Select one or more listing types</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} activeOpacity={0.7} onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={18} color="#555" />
              </TouchableOpacity>
            </View>

            <View style={styles.typeGrid}>
              {LISTING_TYPES.map((type) => {
                const isSelected = selectedTypes.includes(type.id);
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeCard,
                      isSelected && { backgroundColor: type.tint, borderColor: type.color, shadowColor: type.color, shadowOpacity: 0.18, elevation: 3 },
                    ]}
                    onPress={() => toggleType(type.id)}
                    activeOpacity={1}
                  >
                    <View style={[
                      styles.typeIconCircle,
                      { backgroundColor: type.color + '1A' },
                      isSelected && { backgroundColor: '#FFFFFF' },
                    ]}>
                      <Text style={styles.typeCardIcon}>{type.icon}</Text>
                    </View>
                    <Text style={[styles.typeCardLabel, isSelected && { color: type.color }]}>
                      {type.label}
                    </Text>
                    <Text style={styles.typeCardDesc}>{type.desc}</Text>
                    <View style={[styles.typeCardCheck, isSelected ? { backgroundColor: type.color, borderColor: type.color } : { backgroundColor: 'transparent', borderColor: '#D8D8D8' }]}>
                      {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedTypes.length > 0 && (
              <View style={styles.activeDotsRow}>
                <Text style={styles.activeDotsLabel}>
                  {selectedTypes.length} filter{selectedTypes.length > 1 ? 's' : ''} selected
                </Text>
                <View style={styles.activeDots}>
                  {selectedTypes.map((t) => {
                    const type = LISTING_TYPES.find((lt) => lt.id === t);
                    return <View key={t} style={[styles.activeDot, { backgroundColor: type?.color }]} />;
                  })}
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => { setSelectedTypes([]); setShowFilterModal(false); }}
              >
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyBtnText}>
                  Apply{selectedTypes.length > 0 ? ` (${selectedTypes.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── BOTTOM NAV ── */}
      {/* paddingBottom adapts per phone: ~48px for 3-button nav, ~20px for a
          gesture bar, 0 if the phone has neither. Minimum 10 keeps spacing. */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary, fontWeight: '700' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setShowFilterModal(true)}>
          <Ionicons
            name="filter"
            size={24}
            color={COLORS.primary}
          />
          <Text style={[styles.navLabel, { color: COLORS.primary }, selectedTypes.length > 0 && { fontWeight: '700' }]}>
            Filter{selectedTypes.length > 0 ? ` (${selectedTypes.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItemCenter} onPress={() => navigation.navigate('CreateListing')}>
          <View style={styles.postButton}>
            <Ionicons name="add" size={30} color="#fff" />
          </View>
          <Text style={[styles.navLabel, { marginTop: 2, color: COLORS.primary }]}>Post</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Messages')}>
          <View style={{ position: 'relative' }}>
            <Ionicons name="chatbubbles" size={24} color={COLORS.primary} />
            {unreadConvoCount > 0 && (
              <View style={styles.msgBadge}>
                <Text style={styles.msgBadgeText}>{unreadConvoCount > 9 ? '9+' : unreadConvoCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background, paddingTop: STATUSBAR_TOP },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 90 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 20 },
  headerSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, color: COLORS.white, fontWeight: '700' },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginVertical: SPACING.sm, backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, height: 50, gap: 6, borderWidth: 1, borderColor: '#E0E8DB', ...SHADOWS.sm },
  searchFilterBtn: { padding: 6 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 0 },
  searchPlaceholder: { flex: 1, fontSize: 14, color: '#A8B0A2', marginLeft: 8 },

  // Active filter chips
  activeFiltersRow: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, gap: 8 },
  activeChip: { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  activeChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clearAllChip: { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#eee' },
  clearAllChipText: { color: '#666', fontSize: 12, fontWeight: '600' },

  // Categories
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginLeft: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm },
  categoriesRow: { paddingHorizontal: SPACING.lg, gap: 12, paddingBottom: SPACING.sm },
  categoryChip: { alignItems: 'center', gap: 5 },
  categoryChipActive: {},
  categoryIcon: { width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: 1.5, borderColor: '#E8EDE5' },
  categoryIconActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary, borderWidth: 2 },
  categoryEmoji: { fontSize: 24 },
  categoryCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  categoryLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  categoryLabelActive: { color: COLORS.primary, fontWeight: '700' },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm },
  sectionCount: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: 10 },
  gridItem: { width: '48%' },

  // Card
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm },
  cardImageArea: { height: 130, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cardImage: { width: '100%', height: '100%', position: 'absolute' },
  cardEmoji: { fontSize: 52 },
  typeBadge: { position: 'absolute', top: SPACING.sm, left: SPACING.sm, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  typeBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  cardInfo: { padding: SPACING.md, gap: 3 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 18 },
  cardPrice: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardLocation: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  cardLocationText: { fontSize: 11, color: COLORS.textMuted },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...SHADOWS.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textMuted },
  emptyPostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, marginTop: 12, elevation: 3 },
  emptyPostBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingBottom: 44, paddingTop: 12 },
  modalHandle: { width: 42, height: 5, backgroundColor: '#E4E4E4', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 4, letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, color: '#9A9A9A' },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  modalCloseBtnText: { fontSize: 14, color: '#555' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  typeCard: { width: '47.5%', borderRadius: 20, padding: 16, backgroundColor: '#FAFAFA', borderWidth: 1.5, borderColor: '#EFEFEF', position: 'relative', shadowColor: '#000', shadowOpacity: 0, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  typeIconCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  typeCardIcon: { fontSize: 26 },
  typeCardLabel: { fontSize: 15.5, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  typeCardDesc: { fontSize: 11.5, color: '#9A9A9A', lineHeight: 16 },
  typeCardCheck: { position: 'absolute', top: 14, right: 14, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  activeDotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  activeDotsLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  activeDots: { flexDirection: 'row', gap: 6 },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  modalActions: { flexDirection: 'row', gap: 12 },
  clearBtn: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { fontSize: 15, color: '#777', fontWeight: '700' },
  applyBtn: { flex: 2, height: 54, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  applyBtnText: { fontSize: 15.5, color: '#fff', fontWeight: '800', letterSpacing: 0.2 },

  // Bottom nav
  bottomNav: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10, position: 'absolute', bottom: 0, left: 0, right: 0, elevation: 10 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  navItemCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, color: '#999', fontWeight: '500', marginTop: 3 },
  postButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: -22, elevation: 8 },
  msgBadge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#e74c3c', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  msgBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
