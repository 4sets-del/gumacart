import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, FlatList, ScrollView, Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ProductRow, SaveButton } from "../components/ProductCard";
import { SPACING, RADIUS, colorForName, FONTS } from "../constants/theme";
import { getUserBasics, useUserBasicsMap } from "../utils/userCache";
import { academicLabel } from "../constants/school";
import { useSearchAlerts, findAlert, addAlert, removeAlert, keywordsOf } from "../utils/searchAlerts";
import Sheet, { FormField, SheetSection } from "../components/Sheet";
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES, LISTING_TYPES, normalizeCategory, listingTitle, listedMs } from "../constants/listings";
import { useActiveListings } from "../utils/useListings";
import { useSellerRatings } from "../utils/sellerRatings";

const SORT_OPTIONS = [
  { id: "relevant",  label: "Most Relevant" },
  { id: "newest",    label: "Newest First" },
  { id: "priceLow",  label: "Price: Low to High" },
  { id: "priceHigh", label: "Price: High to Low" },
  { id: "rating",    label: "Highest Rated" },
];

const EMPTY_FILTERS = { categories: [], types: [], minPrice: "", maxPrice: "", posted: "any" };

// "Posted within" choices: how far back a listing's posting time may be.
const POSTED_WITHIN = [
  { id: "any", label: "Any time", ms: null },
  { id: "day", label: "Last 24 hours", ms: 24 * 3600 * 1000 },
  { id: "week", label: "This week", ms: 7 * 24 * 3600 * 1000 },
  { id: "month", label: "This month", ms: 30 * 24 * 3600 * 1000 },
];
const postedMs = (l) => listedMs(l) || Date.now();

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Selectable pill used for sort, category and type filters.
function Chip({ selected, label, emoji, onPress }) {
  const { styles } = useTheme(createStyles);
  return (
    <TouchableOpacity
      style={[styles.fChip, selected && styles.fChipOn]}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      {emoji ? <Text style={styles.fChipEmoji}>{emoji}</Text> : null}
      <Text style={[styles.fChipText, selected && styles.fChipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation, route }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const initialCategory = route?.params?.category || null;
  const [searchText, setSearchText]       = useState("");
  // "See All" on Home's "From <course> students" row: only listings by
  // sellers in that course, shown as a removable chip.
  const [courseFilter, setCourseFilter]   = useState(route?.params?.course || null);
  const [activeTab, setActiveTab]         = useState("listings"); // "listings" | "sellers"
  const { listings, loading: loadingListings } = useActiveListings();
  const ratings = useSellerRatings(listings);
  const [sellers, setSellers]             = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [sortBy, setSortBy]               = useState("relevant");
  const [filters, setFilters]             = useState({ ...EMPTY_FILTERS, categories: initialCategory ? [initialCategory] : [] });
  const [sheetVisible, setSheetVisible]   = useState(false);
  const [draftSort, setDraftSort]         = useState(sortBy);
  const [draftFilters, setDraftFilters]   = useState(filters);
  const [searchHistory, setSearchHistory] = useState([]);
  const alerts = useSearchAlerts();
  const inputRef = useRef(null);
  const user = auth.currentUser;

  // Search history is stored on the user's own doc (no extra packages needed).
  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const hist = snap.data()?.searchHistory;
        if (Array.isArray(hist)) setSearchHistory(hist);
      } catch (e) {}
    };
    loadHistory();
  }, []);

  const saveHistory = async (next) => {
    setSearchHistory(next);
    try {
      await setDoc(doc(db, "users", user.uid), { searchHistory: next }, { merge: true });
    } catch (e) {}
  };

  const saveSearch = (term) => {
    const clean = term.trim();
    if (!clean || !user) return;
    // Newest first, no duplicates, cap at 8
    saveHistory([clean, ...searchHistory.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 8));
  };

  // Sellers = people with items on the marketplace right now, worked out from
  // the listings already on the phone; only their profiles are fetched (from
  // the shared cache), instead of downloading every user account.
  const sellersRequested = activeTab === "sellers";
  const sellerCounts = useMemo(() => {
    const counts = new Map();
    listings.forEach((l) => { if (l.sellerId) counts.set(l.sellerId, (counts.get(l.sellerId) || 0) + 1); });
    return counts;
  }, [listings]);
  useEffect(() => {
    if (!sellersRequested) return;
    let cancelled = false;
    Promise.all([...sellerCounts].map(async ([id, count]) => ({ id, uid: id, count, ...(await getUserBasics(id)) })))
      .then((list) => {
        if (cancelled) return;
        setSellers(list.filter((u) => u.role !== "banned").sort((a, b) => b.count - a.count));
        setLoadingSellers(false);
      });
    return () => { cancelled = true; };
  }, [sellersRequested, sellerCounts]);


  // Auto focus when opened as a plain search, not from a category.
  useEffect(() => {
    if (initialCategory) return;
    const id = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(id);
  }, []);

  // ── Filtering + sorting ──
  const term = searchText.trim().toLowerCase();
  const min = parseFloat(filters.minPrice);
  const max = parseFloat(filters.maxPrice);

  const courseSellers = useUserBasicsMap(courseFilter ? listings.map((l) => l.sellerId) : []);

  const filteredListings = listings.filter((l) => {
    const matchSearch = !term ||
      listingTitle(l).toLowerCase().includes(term) ||
      (l.description || "").toLowerCase().includes(term) ||
      (l.location || "").toLowerCase().includes(term) ||
      normalizeCategory(l.category).toLowerCase().includes(term);
    const matchCat  = filters.categories.length === 0 || filters.categories.includes(normalizeCategory(l.category));
    const matchType = filters.types.length === 0 || filters.types.includes(l.type || "sell");
    const price = typeof l.price === "number" ? l.price : null;
    const matchMin = isNaN(min) || (price !== null && price >= min);
    const matchMax = isNaN(max) || (price !== null && price <= max);
    const within = POSTED_WITHIN.find((p) => p.id === (filters.posted || "any"))?.ms;
    const matchPosted = !within || postedMs(l) >= Date.now() - within;
    const matchCourse = !courseFilter || courseSellers[l.sellerId]?.course === courseFilter;
    return matchSearch && matchCat && matchType && matchMin && matchMax && matchPosted && matchCourse;
  });

  const sortedListings = (() => {
    const list = [...filteredListings];
    const hasPrice = (l) => typeof l.price === "number" && (l.type || "sell") !== "donate";
    switch (sortBy) {
      case "priceLow":
      case "priceHigh":
        // Listings without a numeric price go to the end instead of counting as 0.
        return list.sort((a, b) => {
          if (hasPrice(a) && hasPrice(b)) return sortBy === "priceLow" ? a.price - b.price : b.price - a.price;
          return hasPrice(a) ? -1 : hasPrice(b) ? 1 : 0;
        });
      case "rating":
        return list.sort((a, b) => (ratings[b.sellerId]?.avg || 0) - (ratings[a.sellerId]?.avg || 0));
      case "relevant":
        // Title matches first; otherwise keep newest-first order.
        if (!term) return list;
        return list.sort((a, b) =>
          Number(listingTitle(b).toLowerCase().includes(term)) - Number(listingTitle(a).toLowerCase().includes(term)));
      default:
        return list;
    }
  })();

  const filteredSellers = sellers.filter((s) =>
    !term || (s.name || "").toLowerCase().includes(term) || (s.email || "").toLowerCase().includes(term));

  const filterCount = filters.categories.length + filters.types.length + (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0) + ((filters.posted || "any") !== "any" ? 1 : 0);
  const isDefault = sortBy === "relevant" && filterCount === 0;

  const openSheet = () => {
    setDraftSort(sortBy);
    setDraftFilters(filters);
    setSheetVisible(true);
  };

  const applySheet = () => {
    setSortBy(draftSort);
    setFilters(draftFilters);
    setSheetVisible(false);
  };

  const QUICK_CHIPS = [
    { id: "all", label: "All", active: isDefault, onPress: () => { setSortBy("relevant"); setFilters(EMPTY_FILTERS); } },
    {
      id: "price",
      label: sortBy === "priceHigh" ? "Price ↓" : sortBy === "priceLow" ? "Price ↑" : "Price",
      active: sortBy === "priceLow" || sortBy === "priceHigh",
      onPress: () => setSortBy(sortBy === "priceLow" ? "priceHigh" : "priceLow"),
    },
    { id: "newest", label: "Newest", active: sortBy === "newest", onPress: () => setSortBy("newest") },
    { id: "rating", label: "Highest Rated", active: sortBy === "rating", onPress: () => setSortBy("rating") },
  ];

  const renderSeller = ({ item }) => (
    <TouchableOpacity
      style={styles.sellerCard}
      onPress={() => navigation.navigate("SellerProfile", { sellerId: item.uid || item.id, sellerName: item.name })}
      activeOpacity={0.88}
    >
      {item.photoURL ? (
        <Image source={{ uri: item.photoURL }} style={styles.sellerAvatar} />
      ) : (
        <View style={[styles.sellerAvatar, styles.sellerAvatarFallback, { backgroundColor: colorForName(item.name) }]}>
          <Text style={styles.sellerAvatarText}>{item.name?.[0]?.toUpperCase() || "?"}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.sellerNameRow}>
          <Text style={styles.sellerName}>{item.name || "Student"}</Text>
          {item.verificationStatus === "verified" && <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />}
        </View>
        <Text style={styles.sellerEmail} numberOfLines={1}>{item.count} item{item.count !== 1 ? "s" : ""} for sale · {academicLabel(item)}</Text>
        {item.avgRating > 0 && (
          <View style={styles.sellerRatingRow}>
            <Ionicons name="star" size={12} color={COLORS.star} />
            <Text style={styles.sellerRatingText}>{item.avgRating.toFixed(1)}</Text>
            {item.totalReviews > 0 && <Text style={styles.sellerReviewCount}>({item.totalReviews})</Text>}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.borderStrong} />
    </TouchableOpacity>
  );

  const showHistory = term.length === 0 && searchHistory.length > 0 && !initialCategory;
  const currentAlert = findAlert(alerts, term);
  const canAlert = activeTab === "listings" && keywordsOf(term).length > 0;
  const toggleAlert = () => (currentAlert ? removeAlert(currentAlert.id) : addAlert(term)).catch(() => Alert.alert("Error", "Could not update the alert."));

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle={COLORS.statusBar} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={activeTab === "listings" ? "Search listings..." : "Search sellers..."}
            placeholderTextColor={COLORS.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => saveSearch(searchText)}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Listings / Sellers */}
      <View style={styles.segment}>
        {[["listings", "Listings"], ["sellers", "Sellers"]].map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.segmentItem, activeTab === id && styles.segmentItemOn]} activeOpacity={0.8} onPress={() => setActiveTab(id)}>
            <Text style={[styles.segmentText, activeTab === id && styles.segmentTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "listings" && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {courseFilter ? (
              <TouchableOpacity
                style={[styles.chip, styles.chipOn, { flexDirection: "row", gap: 5 }]}
                activeOpacity={0.8}
                onPress={() => setCourseFilter(null)}
                accessibilityRole="button"
                accessibilityLabel={`Showing ${courseFilter} students only. Tap to show everyone.`}
              >
                <Ionicons name="school" size={14} color="#fff" />
                <Text style={[styles.chipText, styles.chipTextOn]}>{courseFilter} students</Text>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            ) : null}
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity key={chip.id} style={[styles.chip, chip.active && styles.chipOn]} activeOpacity={0.8} onPress={chip.onPress}>
                <Text style={[styles.chipText, chip.active && styles.chipTextOn]}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.chip, filterCount > 0 && styles.chipOn, { flexDirection: "row", gap: 5 }]} activeOpacity={0.8} onPress={openSheet}>
              <Ionicons name="options-outline" size={15} color={filterCount > 0 ? "#fff" : COLORS.textPrimary} />
              <Text style={[styles.chipText, filterCount > 0 && styles.chipTextOn]}>Filter{filterCount > 0 ? ` (${filterCount})` : ""}</Text>
            </TouchableOpacity>
          </ScrollView>
          {(filters.categories.length > 0 || (filters.posted || "any") !== "any") && (
            <Text style={styles.activeCats} numberOfLines={1}>
              {[
                filters.categories.length > 0 ? `In ${filters.categories.join(", ")}` : null,
                (filters.posted || "any") !== "any" ? `Posted ${POSTED_WITHIN.find((p) => p.id === filters.posted)?.label.toLowerCase()}` : null,
              ].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
      )}

      {/* Recent searches — shown when the box is empty */}
      {showHistory && (
        <View style={styles.historyBox}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent searches</Text>
            <TouchableOpacity onPress={() => saveHistory([])} activeOpacity={0.7}>
              <Text style={styles.historyClear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyChips}>
            {searchHistory.map((t) => (
              <View key={t} style={styles.historyChip}>
                <TouchableOpacity style={styles.historyChipMain} activeOpacity={0.7} onPress={() => { setSearchText(t); saveSearch(t); }}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.historyChipText}>{t}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${t} from recent searches`} style={styles.historyChipX} activeOpacity={0.7} onPress={() => saveHistory(searchHistory.filter((x) => x !== t))}>
                  <Ionicons name="close" size={13} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* "Notify me": get a notification when a new listing matches */}
      {canAlert && (
        <TouchableOpacity style={[styles.alertBar, currentAlert && styles.alertBarOn]} activeOpacity={0.85} onPress={toggleAlert}>
          <Ionicons name={currentAlert ? "notifications" : "notifications-outline"} size={18} color={currentAlert ? "#fff" : COLORS.primary} />
          <Text style={[styles.alertBarText, currentAlert && { color: "#fff" }]} numberOfLines={1}>
            {currentAlert ? `You'll be notified about "${term}"` : `Notify me about new "${term}" listings`}
          </Text>
          <Text style={[styles.alertBarAction, currentAlert && { color: "rgba(255,255,255,0.85)" }]}>{currentAlert ? "Turn off" : "Turn on"}</Text>
        </TouchableOpacity>
      )}

      {/* Your alerts — shown when the box is empty */}
      {term.length === 0 && activeTab === "listings" && alerts.length > 0 && (
        <View style={styles.historyBox}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Your alerts</Text>
          </View>
          <View style={styles.historyChips}>
            {alerts.map((a) => (
              <View key={a.id} style={[styles.historyChip, { borderColor: COLORS.primary + "55" }]}>
                <TouchableOpacity style={styles.historyChipMain} activeOpacity={0.7} onPress={() => setSearchText(a.term)}>
                  <Ionicons name="notifications" size={13} color={COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.historyChipText}>{a.term}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Turn off alert for ${a.term}`} style={styles.historyChipX} activeOpacity={0.7} onPress={() => removeAlert(a.id).catch(() => {})}>
                  <Ionicons name="close" size={13} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Results */}
      {activeTab === "listings" ? (
        loadingListings ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>
        ) : sortedListings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}><Ionicons name="search" size={36} color={COLORS.primary} /></View>
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptySub}>{canAlert && !currentAlert ? "Turn on the alert above and we'll tell you when someone posts it." : "Try a different search or filter"}</Text>
          </View>
        ) : (
          <FlatList
            data={sortedListings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              return (
                <ProductRow
                  item={item}
                  rating={ratings[item.sellerId]}
                  onPress={() => navigation.navigate("ProductDetail", { product: item })}
                  right={<SaveButton item={item} size={22} plain style={styles.cartBtn} />}
                />
              );
            }}
          />
        )
      ) : loadingSellers ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : filteredSellers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}><Ionicons name="people-outline" size={36} color={COLORS.primary} /></View>
          <Text style={styles.emptyTitle}>No sellers found</Text>
          <Text style={styles.emptySub}>Only people with items on the marketplace are listed. Try a different name.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSellers}
          keyExtractor={(item) => item.id}
          renderItem={renderSeller}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── SORT & FILTER SHEET ── */}
      <Sheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="Sort & Filter"
        subtitle="Narrow down what you're looking for"
        icon="options"
        cancelText="Reset"
        onCancel={() => { setDraftSort("relevant"); setDraftFilters(EMPTY_FILTERS); }}
        action={{ title: "Apply", icon: "checkmark", onPress: applySheet }}
      >
        <SheetSection title="Sort by" />
        <View style={styles.chipWrap}>
          {SORT_OPTIONS.map((opt) => (
            <Chip key={opt.id} label={opt.label} selected={draftSort === opt.id} onPress={() => setDraftSort(opt.id)} />
          ))}
        </View>

        <SheetSection title="Price range" />
        <View style={styles.priceRow}>
          {[["minPrice", "Min", "0"], ["maxPrice", "Max", "Any"]].map(([key, label, placeholder]) => (
            <FormField
              key={key}
              style={{ flex: 1 }}
              label={label}
              icon="cash-outline"
              keyboardType="numeric"
              placeholder={`₱ ${placeholder}`}
              value={draftFilters[key]}
              onChangeText={(v) => setDraftFilters((f) => ({ ...f, [key]: v.replace(/[^0-9.]/g, "") }))}
            />
          ))}
        </View>

        <SheetSection title="Categories" />
        <View style={styles.chipWrap}>
          <Chip
            label="All"
            selected={draftFilters.categories.length === 0}
            onPress={() => setDraftFilters((f) => ({ ...f, categories: [] }))}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.name}
              label={c.name}
              emoji={c.emoji}
              selected={draftFilters.categories.includes(c.name)}
              onPress={() => setDraftFilters((f) => ({ ...f, categories: toggleIn(f.categories, c.name) }))}
            />
          ))}
        </View>

        <SheetSection title="Posted" />
        <View style={styles.chipWrap}>
          {POSTED_WITHIN.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              selected={(draftFilters.posted || "any") === p.id}
              onPress={() => setDraftFilters((f) => ({ ...f, posted: p.id }))}
            />
          ))}
        </View>

        <SheetSection title="Listing type" />
        <View style={styles.chipWrap}>
          {Object.entries(LISTING_TYPES).map(([id, t]) => (
            <Chip
              key={id}
              label={t.label}
              selected={draftFilters.types.includes(id)}
              onPress={() => setDraftFilters((f) => ({ ...f, types: toggleIn(f.types, id) }))}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 6 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },

  // Segment
  segment: { flexDirection: "row", marginHorizontal: SPACING.lg, marginTop: 2, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: RADIUS.full },
  segmentItemOn: { backgroundColor: COLORS.surface, elevation: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  segmentTextOn: { color: COLORS.primary, fontWeight: "700" },

  // Chips
  chipsRow: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, alignItems: "center" },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
  chipTextOn: { color: "#fff" },
  activeCats: { marginHorizontal: SPACING.lg, marginBottom: 4, fontSize: 12.5, color: COLORS.primary, fontWeight: "600" },

  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  cartBtn: { alignSelf: "flex-start", padding: 4 },

  // Sellers
  sellerCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  sellerAvatar: { width: 50, height: 50, borderRadius: 25 },
  sellerAvatarFallback: { backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sellerAvatarText: { fontSize: 20, fontFamily: FONTS.heading, color: "#fff" },
  sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  sellerName: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  sellerEmail: { fontSize: 12, color: COLORS.textMuted, marginBottom: 3 },
  sellerRatingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sellerRatingText: { fontSize: 12.5, fontWeight: "700", color: COLORS.textSecondary },
  sellerReviewCount: { fontSize: 11.5, color: COLORS.textMuted },

  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 70 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIconBox: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.textMuted },

  // History
  historyBox: { paddingHorizontal: SPACING.lg, paddingTop: 4, paddingBottom: 8 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  historyTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  historyClear: { fontSize: 13, color: COLORS.error, fontWeight: "600" },
  historyChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyChip: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, overflow: "hidden" },
  historyChipMain: { flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 6, paddingVertical: 7 },
  historyChipText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "500" },
  historyChipX: { paddingRight: 10, paddingLeft: 2, paddingVertical: 7 },

  // Sheet
  alertBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryPale, borderWidth: 1, borderColor: COLORS.primary + "40" },
  alertBarOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  alertBarText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: COLORS.primary },
  alertBarAction: { fontSize: 12.5, fontWeight: "800", color: COLORS.primary },
  priceRow: { flexDirection: "row", gap: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  fChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  fChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fChipEmoji: { fontSize: 14 },
  fChipText: { fontSize: 13.5, fontWeight: "600", color: COLORS.textSecondary },
  fChipTextOn: { color: "#fff" },
});
