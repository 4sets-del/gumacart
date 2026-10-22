import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { collection, getDocs, doc, getDoc, setDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import WelcomeTutorial from '../components/WelcomeTutorial';
import CoachMark from '../components/CoachMark';
import { ProductCard } from '../components/ProductCard';
import SkeletonCard from '../components/SkeletonCard';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, RADIUS, GRADIENTS, SHADOWS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES, categoryTint } from '../constants/listings';
import { useActiveListings } from '../utils/useListings';
import { useSellerRatings } from '../utils/sellerRatings';
import { popularityScore } from '../utils/views';

const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_W = SCREEN_W - SPACING.lg * 2;
const GRID_GAP = 12;
const GRID_CARD_W = (SCREEN_W - SPACING.lg * 2 - GRID_GAP) / 2;
const PAGE_SIZE = 20;

// Quick filter by listing type (what the old bottom-bar "Filter" button did).
const TYPE_FILTERS = (COLORS) => ([
  { id: 'all',    label: 'All',         icon: 'apps',            color: COLORS.primary },
  { id: 'sell',   label: 'For Sale',    icon: 'pricetag',        color: COLORS.sell },
  { id: 'buy',    label: 'Looking For', icon: 'search',          color: COLORS.buy },
  { id: 'barter', label: 'Barter',      icon: 'swap-horizontal', color: COLORS.barter },
  { id: 'donate', label: 'Donate',      icon: 'gift',            color: COLORS.donate },
]);

const BANNERS = [
  { title: 'Good Finds,\nGreat Deals!', text: 'Shop local. Support your fellow SLSU students.', icon: 'bag-handle', colors: GRADIENTS.primary },
  { title: 'Declutter &\nEarn', text: 'Sell what you no longer need in a few taps.', icon: 'pricetags', colors: GRADIENTS.sunset },
  { title: 'Barter or\nDonate', text: 'Trade items or give them to someone who needs them.', icon: 'swap-horizontal', colors: GRADIENTS.berry },
];

export default function HomeScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { listings, loading: listingsLoading } = useActiveListings();
  const ratings = useSellerRatings(listings);
  const [cartCount, setCartCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef(null);

  const user = auth.currentUser;

  // Show the welcome tutorial once, on first launch after verifying.
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
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

  const handleWelcomeDone = () => {
    setShowWelcome(false);
    setShowCoachMarks(true);
  };

  const finishCoachMarks = async () => {
    setShowCoachMarks(false);
    try {
      await setDoc(doc(db, 'users', user.uid), { hasSeenWelcome: true }, { merge: true });
    } catch (e) {}
  };

  // Refs so CoachMark can measure each element's on-screen position.
  const notifRef = useRef(null);
  const cartRef = useRef(null);
  const searchRef = useRef(null);
  const categoriesRef = useRef(null);

  const coachSteps = [
    { ref: notifRef, title: 'Notifications', text: 'Get notified here about new messages, followers, and updates on your listings.' },
    { ref: cartRef, title: 'Cart', text: "Items you're interested in buying are saved here for quick access." },
    { ref: searchRef, title: 'Search', text: 'Search for listings or sellers, then sort and filter the results.' },
    { ref: categoriesRef, title: 'Categories', text: 'Jump straight to a category. Use the tabs below to sell, chat, and see your profile.' },
  ];

  // ── Firestore: cart ──
  const loadCartCount = async () => {
    if (!user?.uid) return;
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'cart'));
      setCartCount(snap.size);
    } catch (e) {}
  };

  useEffect(() => {
    loadCartCount();
    return navigation.addListener('focus', loadCartCount);
  }, [navigation]);

  // ── Firestore: unread notification count for the bell badge ──
  useEffect(() => {
    if (!user?.uid) return;
    // Only unread notifications are downloaded, not the whole history.
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'notifications'), where('read', '==', false)),
      (snap) => setNotifCount(snap.size > 9 ? '9+' : snap.size),
      () => {}
    );
    return unsub;
  }, []);

  // Build the other tabs in the background shortly after Home appears, so
  // the first tap on Categories / Messages / Profile opens instantly.
  useEffect(() => {
    const id = setTimeout(() => {
      ['Categories', 'Messages', 'Profile'].forEach((name) => navigation.preload?.(name));
    }, 1200);
    return () => clearTimeout(id);
  }, [navigation]);

  // ── Banner auto-advance ──
  useEffect(() => {
    const id = setInterval(() => {
      setBannerIndex((i) => {
        const next = (i + 1) % BANNERS.length;
        bannerRef.current?.scrollTo({ x: next * (BANNER_W + SPACING.md), animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCartCount();
    setRefreshing(false);
  };

  const openCategory = (name) => navigation.navigate('Search', { category: name });
  const openProduct = useCallback((item) => navigation.navigate('ProductDetail', { product: item }), [navigation]);

  // Featured = the 8 most popular active listings (seller rating + views).
  // `listings` is newest-first and the sort is stable, so ties — including
  // when nothing has ratings or views yet — fall back to the newest.
  const featured = useMemo(
    () => [...listings]
      .sort((a, b) => popularityScore(b, ratings[b.sellerId]) - popularityScore(a, ratings[a.sellerId]))
      .slice(0, 8),
    [listings, ratings],
  );
  const [typeFilter, setTypeFilter] = useState('all');
  const shownListings = typeFilter === 'all' ? listings : listings.filter((l) => (l.type || 'sell') === typeFilter);

  // Draw the grid in pages so a large marketplace doesn't render every card
  // at once; more are added as the user nears the bottom.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [typeFilter]);
  const onScroll = ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600 && visibleCount < shownListings.length) {
      setVisibleCount((c) => c + PAGE_SIZE);
    }
  };

  return (
    <View style={styles.safe}>
      {isFocused && <StatusBar barStyle="light-content" />}

      <WelcomeTutorial visible={showWelcome} onClose={handleWelcomeDone} />
      <CoachMark visible={showCoachMarks} steps={coachSteps} onFinish={finishCoachMarks} />

      {/* ── GREEN HEADER (sits behind the status bar too) ── */}
      <LinearGradient colors={GRADIENTS.primaryDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerGlow} />
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <View>
              <Text style={styles.headerHello}>Hi, {user?.displayName?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={styles.headerTitle}>SLSU-GumaCart</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"} ref={cartRef} collapsable={false} style={styles.iconBtn} onPress={() => navigation.navigate('Cart')}>
              <Ionicons name="cart-outline" size={22} color="#fff" />
              {cartCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={notifCount ? `Notifications, ${notifCount} unread` : "Notifications"} ref={notifRef} collapsable={false} style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {notifCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{notifCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SEARCH BAR ── */}
        <TouchableOpacity
          ref={searchRef}
          collapsable={false}
          style={styles.searchWrap}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={18} color={COLORS.primary} />
          <Text style={styles.searchPlaceholder}>Search for products, categories, or sellers...</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: SPACING.lg, paddingBottom: 24 }}
        onScroll={onScroll}
        scrollEventThrottle={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >

        {/* ── BANNER CAROUSEL ── */}
        <ScrollView
          ref={bannerRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={BANNER_W + SPACING.md}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.md }}
          onMomentumScrollEnd={(e) => setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + SPACING.md)))}
        >
          {BANNERS.map((b) => (
            <LinearGradient key={b.title} colors={b.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <View style={styles.bannerCircle} />
              <View style={styles.bannerCircleSmall} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                <Text style={styles.bannerText}>{b.text}</Text>
              </View>
              <View style={styles.bannerIconBox}>
                <Ionicons name={b.icon} size={42} color="#fff" />
              </View>
            </LinearGradient>
          ))}
        </ScrollView>
        <View style={styles.dotsRow}>
          {BANNERS.map((b, i) => (
            <View key={b.title} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
          ))}
        </View>

        {/* ── CATEGORIES ── */}
        <ScrollView
          ref={categoriesRef}
          collapsable={false}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          <TouchableOpacity style={styles.categoryItem} activeOpacity={0.7} onPress={() => navigation.navigate('Categories')}>
            <View style={[styles.categoryCircle, { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary + '40' }]}>
              <Ionicons name="grid-outline" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.categoryLabel}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.name} style={styles.categoryItem} activeOpacity={0.7} onPress={() => openCategory(cat.name)}>
              <View style={[styles.categoryCircle, { backgroundColor: categoryTint(cat), borderColor: cat.color + '40' }]}>
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              </View>
              <Text style={styles.categoryLabel} numberOfLines={2}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {listingsLoading && listings.length === 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.skeletonTitle, { width: 170 }]} />
            </View>
            <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
              {[0, 1, 2].map((i) => <SkeletonCard key={i} width={128} />)}
            </ScrollView>
            <View style={styles.sectionHeader}>
              <View style={[styles.skeletonTitle, { width: 140 }]} />
            </View>
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} width={GRID_CARD_W} />)}
            </View>
          </>
        ) : listings.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="storefront-outline" size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyText}>No listings yet</Text>
            <Text style={styles.emptySub}>Be the first to post something!</Text>
            <TouchableOpacity style={styles.emptyPostBtn} activeOpacity={0.85} onPress={() => navigation.navigate('CreateListing')}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyPostBtnText}>Post a Listing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── FEATURED ── */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: '#F59E0B2E' }]}><Ionicons name="flame" size={15} color="#F59E0B" /></View>
                <Text style={styles.sectionTitle}>Featured Listings</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
              {featured.map((item) => (
                <ProductCard key={item.id} item={item} rating={ratings[item.sellerId]} width={128} onPress={openProduct} />
              ))}
            </ScrollView>

            {/* ── ALL LISTINGS ── */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: '#2563EB2E' }]}><Ionicons name="sparkles" size={15} color="#2563EB" /></View>
                <Text style={styles.sectionTitle}>Latest Listings</Text>
              </View>
              <Text style={styles.sectionCount}>{shownListings.length} items</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {TYPE_FILTERS(COLORS).map((t) => {
                const active = typeFilter === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.8}
                    onPress={() => setTypeFilter(t.id)}
                    style={[styles.typeChip, { borderColor: t.color + '55' }, active && { backgroundColor: t.color, borderColor: t.color }]}
                  >
                    <Ionicons name={t.icon} size={14} color={active ? '#fff' : t.color} />
                    <Text style={[styles.typeChipText, { color: active ? '#fff' : t.color }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {shownListings.length === 0 ? (
              <View style={styles.typeEmpty}>
                <Ionicons name="file-tray-outline" size={30} color={COLORS.textMuted} />
                <Text style={styles.emptySub}>No {TYPE_FILTERS(COLORS).find((t) => t.id === typeFilter)?.label} listings right now.</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {shownListings.slice(0, visibleCount).map((item) => (
                  <ProductCard key={item.id} item={item} rating={ratings[item.sellerId]} width={GRID_CARD_W} onPress={openProduct} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  headerGlow: { position: 'absolute', right: -50, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  headerHello: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  headerTitle: { fontSize: 19, fontFamily: FONTS.heading, color: '#fff', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: COLORS.surface },
  badgeText: { fontSize: 9, color: COLORS.white, fontFamily: FONTS.heading },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, height: 48, ...SHADOWS.md },
  searchPlaceholder: { flex: 1, fontSize: 13.5, color: COLORS.textMuted },

  // Banner
  banner: { width: BANNER_W, height: 150, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, overflow: 'hidden' },
  bannerCircle: { position: 'absolute', right: -40, top: -30, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.15)' },
  bannerCircleSmall: { position: 'absolute', right: 70, bottom: -40, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.10)' },
  bannerTitle: { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.white, lineHeight: 27 },
  bannerText: { fontSize: 12.5, color: 'rgba(255,255,255,0.92)', marginTop: 8, lineHeight: 17, maxWidth: 190 },
  bannerIconBox: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.borderStrong },
  dotActive: { width: 18, backgroundColor: COLORS.primary },

  // Categories
  categoriesRow: { paddingHorizontal: SPACING.lg, gap: 14, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  categoryItem: { alignItems: 'center', width: 66 },
  categoryCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 2 },
  categoryEmoji: { fontSize: 26 },
  categoryLabel: { fontSize: 11, color: COLORS.textPrimary, fontWeight: '600', textAlign: 'center', lineHeight: 14 },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  seeAll: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  sectionCount: { fontSize: 12.5, color: COLORS.textMuted },
  featuredRow: { paddingHorizontal: SPACING.lg, gap: SPACING.md, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.lg, gap: GRID_GAP },
  skeletonTitle: { height: 18, borderRadius: 9, backgroundColor: COLORS.surfaceAlt },
  typeRow: { paddingHorizontal: SPACING.lg, gap: 8, paddingBottom: SPACING.md },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, backgroundColor: COLORS.surface },
  typeChipText: { fontSize: 12.5, fontWeight: '700' },
  typeEmpty: { alignItems: 'center', paddingVertical: 30, gap: 6 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 50, gap: 6 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 16, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textMuted },
  emptyPostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 22, paddingVertical: 12, marginTop: 12 },
  emptyPostBtnText: { color: '#fff', fontFamily: FONTS.heading, fontSize: 14 },
});
