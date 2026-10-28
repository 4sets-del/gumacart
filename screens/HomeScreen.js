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
  FlatList,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { collection, doc, getDoc, setDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { tabTarget } from '../utils/tourTargets';
import { useAuth } from '../context/AuthContext';
import { useUserBasicsMap } from '../utils/userCache';
import { useWishlist } from '../utils/wishlist';
import CoachMark from '../components/CoachMark';
import { ProductCard } from '../components/ProductCard';
import SkeletonCard from '../components/SkeletonCard';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, RADIUS, GRADIENTS, SHADOWS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { normalizeCourse } from '../constants/school';
import { CATEGORIES, categoryTint } from '../constants/listings';
import { useActiveListings } from '../utils/useListings';
import { useSellerRatings } from '../utils/sellerRatings';
import { popularityScore } from '../utils/views';

const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_W = SCREEN_W - SPACING.lg * 2;
const GRID_GAP = 12;
const GRID_CARD_W = (SCREEN_W - SPACING.lg * 2 - GRID_GAP) / 2;
const GridGap = () => <View style={{ height: GRID_GAP }} />;

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

export default function HomeScreen({ navigation, route }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { listings, loading: listingsLoading } = useActiveListings();
  const ratings = useSellerRatings(listings);
  const savedCount = useWishlist().items.length;
  const [refreshing, setRefreshing] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef(null);

  const user = auth.currentUser;

  // "From your course": listings by sellers in the same course as you. The
  // row only shows once there are enough to fill it; fewer looks unfinished
  // (Search → Filter → Seller's course always works).
  const MIN_COURSE_LISTINGS = 6;
  const { userProfile } = useAuth();
  const ownCourse = normalizeCourse(userProfile?.course);
  const myCourse = ownCourse && ownCourse !== 'Other' ? ownCourse : null;
  const sellerProfiles = useUserBasicsMap(myCourse ? listings.map((l) => l.sellerId) : []);
  const courseListings = useMemo(
    () => (myCourse ? listings.filter((l) => sellerProfiles[l.sellerId]?.course === myCourse).slice(0, 10) : []),
    [listings, sellerProfiles, myCourse],
  );

  // Show the interactive tour once, on first launch after verifying.
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  useEffect(() => {
    const checkWelcome = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data()?.hasSeenWelcome !== true) {
          setShowCoachMarks(true);
        }
      } catch (e) {}
    };
    checkWelcome();
  }, []);

  // Settings → "App Tour" sends { startTour } to replay it.
  const startTour = route?.params?.startTour;
  useEffect(() => {
    if (startTour) setShowCoachMarks(true);
  }, [startTour]);

  const finishCoachMarks = async () => {
    setShowCoachMarks(false);
    try {
      await setDoc(doc(db, 'users', user.uid), { hasSeenWelcome: true }, { merge: true });
    } catch (e) {}
  };

  // Refs so CoachMark can measure each element's on-screen position.
  const notifRef = useRef(null);
  const savedRef = useRef(null);
  const searchRef = useRef(null);
  const categoriesRef = useRef(null);
  const featuredRef = useRef(null);
  const typeChipsRef = useRef(null);
  const rootRef = useRef(null);

  // Interactive tour of the main features. Steps without a ref appear in the
  // middle of the screen; tab steps point at the bottom bar.
  const coachSteps = useMemo(() => [
    { icon: 'storefront', title: 'Welcome to GumaCart!', text: 'The campus marketplace for SLSU Gumaca. Here is a quick tour of everything you can do. Tap Next to start.' },
    { ref: searchRef, icon: 'search', title: 'Search', text: 'Find items or sellers, then Sort & Filter by price, category and listing type.' },
    { ref: savedRef, icon: 'heart', shape: 'circle', title: 'Saved items', text: 'Tap ♡ on any item to save it for later. Your saved items are kept here, and you\'re told if the price drops.' },
    { ref: notifRef, icon: 'notifications', shape: 'circle', title: 'Notifications', text: 'Messages, reviews, price drops, and updates when an item you want is reserved or sold.' },
    { ref: categoriesRef, icon: 'grid', title: 'Categories', text: 'Jump straight to Food & Drinks, Clothes, Academic and more.' },
    { ref: featuredRef, icon: 'flame', title: 'Featured listings', text: 'Popular items from well-rated sellers. Open one to see photos, save it, or chat with the seller.', optional: true },
    { ref: typeChipsRef, icon: 'pricetags', title: 'Listing types', text: 'Show only For Sale, Wanted, Barter or Free items.', optional: true },
    { ref: tabTarget(2), icon: 'add-circle', shape: 'circle', title: 'Post a listing', text: 'Tap + and choose: For Sale, Looking For, Barter, or Donate. Add as many photos and videos as you like, and a quantity.' },
    { ref: tabTarget(2), icon: 'shield-checkmark', shape: 'circle', title: 'Get verified first', text: 'Before your first post, send your student ID once. An admin approves it, usually within 1–2 days.' },
    { ref: tabTarget(3), icon: 'chatbubbles', title: 'Messages', text: 'Chat with buyers and sellers. Send photos and videos, react or reply with a long-press, and see when it\'s Seen.' },
    { ref: tabTarget(4), icon: 'bookmark', title: 'Your listings', text: 'In Profile → My Listings: edit, reserve an item for one buyer, or mark it sold. Interested buyers are notified automatically.' },
    { ref: tabTarget(4), icon: 'star', title: 'Ratings', text: 'Buyers rate sellers after a sale. Good ratings help your items get Featured.' },
    { icon: 'flag', title: 'Stay safe', text: 'Meet in public places on campus and check items before paying. See something wrong? Tap the 🚩 flag on any listing or profile to report it.' },
    { ref: tabTarget(4), icon: 'settings', title: 'Settings', text: 'In Profile → Settings: edit your course and year, switch to dark mode, choose notifications, and replay this tour anytime.' },
  ], []);


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


  // Everything above the "All Listings" grid. The grid itself is a
  // virtualized FlatList, so only cards near the screen are drawn even when
  // the marketplace has hundreds of items.
  const listHeader = (
    <View style={{ paddingTop: SPACING.lg }}>

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
            {[0, 1, 2].map((i) => <SkeletonCard key={i} width={150} />)}
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
          <View style={styles.sectionHeader} ref={featuredRef} collapsable={false}>
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
              <ProductCard key={item.id} item={item} rating={ratings[item.sellerId]} width={150} onPress={openProduct} />
            ))}
          </ScrollView>

          {/* ── FROM YOUR COURSE ── */}
          {courseListings.length >= MIN_COURSE_LISTINGS && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIcon, { backgroundColor: '#7C3AED2E' }]}><Ionicons name="school" size={15} color="#7C3AED" /></View>
                  <Text style={styles.sectionTitle}>From {myCourse} students</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Search', { course: myCourse })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
                {courseListings.map((item) => (
                  <ProductCard key={item.id} item={item} rating={ratings[item.sellerId]} width={150} onPress={openProduct} />
                ))}
              </ScrollView>
            </>
          )}

          {/* ── ALL LISTINGS ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: '#2563EB2E' }]}><Ionicons name="sparkles" size={15} color="#2563EB" /></View>
              <Text style={styles.sectionTitle}>All Listings</Text>
            </View>
            <Text style={styles.sectionCount}>{shownListings.length} items · newest first</Text>
          </View>
          <ScrollView ref={typeChipsRef} collapsable={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
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
        </>
      )}
    </View>
  );
  const showGrid = !(listingsLoading && listings.length === 0) && listings.length > 0;

  return (
    <View style={styles.safe} ref={rootRef} collapsable={false}>
      {isFocused && <StatusBar barStyle="light-content" />}

      <CoachMark visible={showCoachMarks} steps={coachSteps} onFinish={finishCoachMarks} originRef={rootRef} />

      {/* ── GREEN HEADER (sits behind the status bar too) ── */}
      <LinearGradient colors={GRADIENTS.primaryDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerGlow} />
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerHello} numberOfLines={1}>Hi, {user?.displayName?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>SLSU-GumaCart</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={savedCount > 0 ? `Saved items, ${savedCount}` : "Saved items"} ref={savedRef} collapsable={false} style={styles.iconBtn} onPress={() => navigation.navigate('Saved')}>
              <Ionicons name="heart-outline" size={22} color="#fff" />
              {savedCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{savedCount > 9 ? '9+' : savedCount}</Text></View>
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

      <FlatList
        data={showGrid ? shownListings : []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ItemSeparatorComponent={GridGap}
        renderItem={({ item }) => (
          <ProductCard item={item} rating={ratings[item.sellerId]} width={GRID_CARD_W} onPress={openProduct} />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={showGrid ? (
          <View style={styles.typeEmpty}>
            <Ionicons name="file-tray-outline" size={30} color={COLORS.textMuted} />
            <Text style={styles.emptySub}>No {TYPE_FILTERS(COLORS).find((t) => t.id === typeFilter)?.label} listings right now.</Text>
          </View>
        ) : null}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  headerGlow: { position: 'absolute', right: -50, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 8 },
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
  gridRow: { paddingHorizontal: SPACING.lg, gap: GRID_GAP },
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
