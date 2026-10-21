import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, FlatList, ScrollView, Image,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ProductRow } from "../components/ProductCard";
import { COLORS, SPACING, RADIUS, colorForName, FONTS } from "../constants/theme";
import { CATEGORIES, LISTING_TYPES, normalizeCategory, listingTitle } from "../constants/listings";
import { useActiveListings } from "../utils/useListings";
import { useSellerRatings } from "../utils/sellerRatings";
import { addToCart, removeFromCart } from "../utils/cart";

const SORT_OPTIONS = [
  { id: "relevant",  label: "Most Relevant" },
  { id: "newest",    label: "Newest First" },
  { id: "priceLow",  label: "Price: Low to High" },
  { id: "priceHigh", label: "Price: High to Low" },
  { id: "rating",    label: "Highest Rated" },
];

const EMPTY_FILTERS = { categories: [], types: [], minPrice: "", maxPrice: "" };

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Checkbox({ checked, label, onPress }) {
  return (
    <TouchableOpacity style={styles.checkRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Radio({ selected, label, onPress }) {
  return (
    <TouchableOpacity style={styles.checkRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialCategory = route?.params?.category || null;
  const [searchText, setSearchText]       = useState("");
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
  const [cartIds, setCartIds]             = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
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

  // Load sellers only when the Sellers tab is first opened — this reads every
  // user document, so it shouldn't happen for plain listing searches.
  const sellersRequested = activeTab === "sellers";
  useEffect(() => {
    if (!sellersRequested || sellers.length > 0) return;
    const loadSellers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        setSellers(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.uid !== user?.uid && u.role !== "banned"),
        );
      } catch (e) { console.log(e.message); }
      finally { setLoadingSellers(false); }
    };
    loadSellers();
  }, [sellersRequested]);

  // Cart membership, so the cart button on each row shows its state.
  const loadCartIds = async () => {
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "cart"));
      setCartIds(snap.docs.map((d) => d.id));
    } catch (e) {}
  };
  useEffect(() => {
    loadCartIds();
    return navigation.addListener("focus", loadCartIds);
  }, [navigation]);

  const toggleCart = async (item) => {
    const inCart = cartIds.includes(item.id);
    setCartIds((prev) => toggleIn(prev, item.id));
    try {
      if (inCart) await removeFromCart(user.uid, item.id);
      else await addToCart(user.uid, item);
    } catch (e) {
      setCartIds((prev) => toggleIn(prev, item.id));
      Alert.alert("Error", "Could not update cart.");
    }
  };

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
    return matchSearch && matchCat && matchType && matchMin && matchMax;
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

  const filterCount = filters.categories.length + filters.types.length + (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0);
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
        <Text style={styles.sellerEmail} numberOfLines={1}>{item.email}</Text>
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

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
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
            <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          {filters.categories.length > 0 && (
            <Text style={styles.activeCats} numberOfLines={1}>
              In {filters.categories.join(", ")}
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
                <TouchableOpacity style={styles.historyChipX} activeOpacity={0.7} onPress={() => saveHistory(searchHistory.filter((x) => x !== t))}>
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
            <Text style={styles.emptySub}>Try a different search or filter</Text>
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
              const inCart = cartIds.includes(item.id);
              return (
                <ProductRow
                  item={item}
                  rating={ratings[item.sellerId]}
                  onPress={() => navigation.navigate("ProductDetail", { product: item })}
                  right={
                    <TouchableOpacity style={styles.cartBtn} onPress={() => toggleCart(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name={inCart ? "cart" : "cart-outline"} size={21} color={inCart ? COLORS.primary : COLORS.textMuted} />
                    </TouchableOpacity>
                  }
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
          <Text style={styles.emptySub}>Try a different name or email</Text>
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
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheetVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setSheetVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetSection}>Sort By</Text>
              {SORT_OPTIONS.map((opt) => (
                <Radio key={opt.id} label={opt.label} selected={draftSort === opt.id} onPress={() => setDraftSort(opt.id)} />
              ))}

              <Text style={styles.sheetSection}>Price Range</Text>
              <View style={styles.priceRow}>
                {[["minPrice", "Min", "0"], ["maxPrice", "Max", "Any"]].map(([key, label, placeholder]) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={styles.priceLabel}>{label}</Text>
                    <View style={styles.priceInputWrap}>
                      <Text style={styles.peso}>₱</Text>
                      <TextInput
                        style={styles.priceInput}
                        keyboardType="numeric"
                        placeholder={placeholder}
                        placeholderTextColor={COLORS.textMuted}
                        value={draftFilters[key]}
                        onChangeText={(v) => setDraftFilters((f) => ({ ...f, [key]: v.replace(/[^0-9.]/g, "") }))}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.sheetSection}>Categories</Text>
              <Checkbox
                label="All Categories"
                checked={draftFilters.categories.length === 0}
                onPress={() => setDraftFilters((f) => ({ ...f, categories: [] }))}
              />
              {CATEGORIES.map((c) => (
                <Checkbox
                  key={c.name}
                  label={c.name}
                  checked={draftFilters.categories.includes(c.name)}
                  onPress={() => setDraftFilters((f) => ({ ...f, categories: toggleIn(f.categories, c.name) }))}
                />
              ))}

              <Text style={styles.sheetSection}>Listing Type</Text>
              {Object.entries(LISTING_TYPES).map(([id, t]) => (
                <Checkbox
                  key={id}
                  label={t.label}
                  checked={draftFilters.types.includes(id)}
                  onPress={() => setDraftFilters((f) => ({ ...f, types: toggleIn(f.types, id) }))}
                />
              ))}
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.resetBtn} activeOpacity={0.8} onPress={() => { setDraftSort("relevant"); setDraftFilters(EMPTY_FILTERS); }}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={applySheet}>
                <Text style={styles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 6 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },

  // Segment
  segment: { flexDirection: "row", marginHorizontal: SPACING.lg, marginTop: 2, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: RADIUS.full },
  segmentItemOn: { backgroundColor: COLORS.white, elevation: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
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
  sellerCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
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
  sheetOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  sheet: { maxHeight: "88%", backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  sheetSection: { fontSize: 14.5, fontWeight: "700", color: COLORS.textPrimary, marginTop: 18, marginBottom: 6 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  checkLabel: { fontSize: 14, color: COLORS.textPrimary },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  priceRow: { flexDirection: "row", gap: 14 },
  priceLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  priceInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, height: 44 },
  peso: { fontSize: 14, color: COLORS.textSecondary, marginRight: 4 },
  priceInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 0 },
  sheetActions: { flexDirection: "row", gap: 12, paddingTop: SPACING.lg },
  resetBtn: { flex: 1, height: 50, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  resetText: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  applyBtn: { flex: 1, height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  applyText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
