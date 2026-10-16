import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, FlatList, ScrollView, Image, ActivityIndicator, Platform,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { collection, query, orderBy, onSnapshot, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";

const CATEGORIES = [
  { id: "all",         label: "All",         emoji: "🔍" },
  { id: "Clothing",    label: "Clothing",    emoji: "👕" },
  { id: "Electronics", label: "Electronics", emoji: "💻" },
  { id: "Books",       label: "Books",       emoji: "📚" },
  { id: "Furniture",   label: "Furniture",   emoji: "🛋️" },
  { id: "Sports",      label: "Sports",      emoji: "⚽" },
  { id: "Others",      label: "Others",      emoji: "📦" },
];

const TYPES = [
  { id: "all",    label: "All Types" },
  { id: "sell",   label: "For Sale"  },
  { id: "buy",    label: "Wanted"    },
  { id: "barter", label: "Barter"    },
  { id: "donate", label: "Free"      },
];

const TYPE_COLORS = { sell: GREEN, buy: "#2980b9", barter: "#e67e22", donate: "#e74c3c" };
const TYPE_LABELS = { sell: "FOR SALE", buy: "WANTED", barter: "BARTER", donate: "FREE" };

export default function SearchScreen({ navigation }) {
  const [searchText, setSearchText]             = useState("");
  const [activeTab, setActiveTab]               = useState("listings"); // "listings" | "sellers"
  const [listings, setListings]                 = useState([]);
  const [sellers, setSellers]                   = useState([]);
  const [loadingListings, setLoadingListings]   = useState(true);
  const [loadingSellers, setLoadingSellers]     = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]); // multi-select
  const [selectedTypes, setSelectedTypes]             = useState([]); // multi-select
  const [searchHistory, setSearchHistory]             = useState([]);
  const inputRef = useRef(null);
  const user = auth.currentUser;

  // Load listings
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

  const saveSearch = async (term) => {
    const clean = term.trim();
    if (!clean || !user) return;
    // Newest first, no duplicates, cap at 8
    const next = [clean, ...searchHistory.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    setSearchHistory(next);
    try {
      await setDoc(doc(db, "users", user.uid), { searchHistory: next }, { merge: true });
    } catch (e) {}
  };

  const removeSearch = async (term) => {
    const next = searchHistory.filter((t) => t !== term);
    setSearchHistory(next);
    try {
      await setDoc(doc(db, "users", user.uid), { searchHistory: next }, { merge: true });
    } catch (e) {}
  };

  const clearAllHistory = async () => {
    setSearchHistory([]);
    try {
      await setDoc(doc(db, "users", user.uid), { searchHistory: [] }, { merge: true });
    } catch (e) {}
  };

  useEffect(() => {
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.sellerId !== user?.uid && item.status === "active");
      setListings(items);
      setLoadingListings(false);
    }, (e) => { console.log(e.message); setLoadingListings(false); });
    return unsub;
  }, []);

  // Load sellers (verified users with listings)
  useEffect(() => {
    const loadSellers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const allUsers = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.uid !== user?.uid && u.role !== "banned");
        setSellers(allUsers);
      } catch (e) { console.log(e.message); }
      finally { setLoadingSellers(false); }
    };
    loadSellers();
  }, []);

  // Auto focus
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const toggleCategory = (catId) => {
    if (catId === "all") { setSelectedCategories([]); return; }
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const toggleType = (typeId) => {
    if (typeId === "all") { setSelectedTypes([]); return; }
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  // Filter listings
  const filteredListings = listings.filter((l) => {
    const matchSearch = !searchText.trim() ||
      (l.title || l.name || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (l.description || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (l.location || "").toLowerCase().includes(searchText.toLowerCase());
    const matchCat  = selectedCategories.length === 0 || selectedCategories.includes(l.category);
    const matchType = selectedTypes.length === 0 || selectedTypes.includes(l.type);
    return matchSearch && matchCat && matchType;
  });

  // Filter sellers
  const filteredSellers = sellers.filter((s) => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  });

  const priceLabel = (item) => {
    if (item.type === "donate") return { label: "FREE",        color: "#e74c3c" };
    if (item.type === "barter") return { label: "For Barter",  color: "#e67e22" };
    if (item.type === "buy")    return { label: "Looking For", color: "#2980b9" };
    return { label: `₱${item.price?.toLocaleString()}`, color: GREEN };
  };

  const renderListing = ({ item }) => {
    const imgUrl = item.images?.[0] || item.image || null;
    const typeColor = TYPE_COLORS[item.type] || GREEN;
    const typeLabel = TYPE_LABELS[item.type] || "FOR SALE";
    const { label, color } = priceLabel(item);
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ProductDetail", { product: item })} activeOpacity={0.88}>
        <View style={[styles.cardImageBox, { backgroundColor: typeColor }]}>
          {imgUrl ? (
            <Image
              source={{ uri: imgUrl }}
              style={styles.cardImage}
              resizeMode="cover"
              onError={() => {}}
            />
          ) : (
            <Text style={styles.cardEmoji}>🛍️</Text>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title || item.name}</Text>
          <Text style={[styles.cardPrice, { color }]}>{label}</Text>
          <View style={styles.cardLocation}>
            <Ionicons name="location-sharp" size={11} color="#aaa" />
            <Text style={styles.cardLocationText} numberOfLines={1}>{item.location}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSeller = ({ item }) => {
    const initial = item.name?.[0]?.toUpperCase() || "?";
    return (
      <TouchableOpacity
        style={styles.sellerCard}
        onPress={() => navigation.navigate("SellerProfile", { sellerId: item.uid || item.id, sellerName: item.name })}
        activeOpacity={0.88}
      >
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.sellerAvatar} />
        ) : (
          <View style={styles.sellerAvatarCircle}>
            <Text style={styles.sellerAvatarText}>{initial}</Text>
          </View>
        )}
        <View style={styles.sellerInfo}>
          <View style={styles.sellerNameRow}>
            <Text style={styles.sellerName}>{item.name || "Student"}</Text>
            {item.verificationStatus === "verified" && (
              <Ionicons name="checkmark-circle" size={14} color={GREEN} />
            )}
          </View>
          <Text style={styles.sellerEmail} numberOfLines={1}>{item.email}</Text>
          {item.avgRating > 0 && (
            <View style={styles.sellerRatingRow}>
              <Ionicons name="star" size={12} color="#F4C542" />
              <Text style={styles.sellerRatingText}>{item.avgRating?.toFixed(1)}</Text>
              {item.totalReviews > 0 && (
                <Text style={styles.sellerReviewCount}>({item.totalReviews} reviews)</Text>
              )}
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="dark-content" backgroundColor={LIGHT_BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={activeTab === "listings" ? "Search listings..." : "Search sellers..."}
            placeholderTextColor="#aaa"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => saveSearch(searchText)}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Listings / Sellers tabs */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === "listings" && styles.mainTabActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab("listings")}
        >
          <Text style={[styles.mainTabText, activeTab === "listings" && styles.mainTabTextActive]}>🛍️ Listings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === "sellers" && styles.mainTabActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab("sellers")}
        >
          <Text style={[styles.mainTabText, activeTab === "sellers" && styles.mainTabTextActive]}>👥 Sellers</Text>
        </TouchableOpacity>
      </View>

      {/* Listings filters */}
      {activeTab === "listings" && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
            style={styles.filterScroll}
          >
            {CATEGORIES.map((item) => {
              const isActive = item.id === "all" ? selectedCategories.length === 0 : selectedCategories.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  activeOpacity={0.7}
                  onPress={() => toggleCategory(item.id)}
                >
                  <Text style={styles.filterEmoji}>{item.emoji}</Text>
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
            style={styles.filterScroll}
          >
            {TYPES.map((item) => {
              const isActive = item.id === "all" ? selectedTypes.length === 0 : selectedTypes.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.typeChip, isActive && styles.typeChipActive]}
                  activeOpacity={0.7}
                  onPress={() => toggleType(item.id)}
                >
                  <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Results count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {activeTab === "listings"
            ? `${loadingListings ? "..." : filteredListings.length} listing${filteredListings.length !== 1 ? "s" : ""}${searchText ? ` for "${searchText}"` : ""}`
            : `${loadingSellers ? "..." : filteredSellers.length} seller${filteredSellers.length !== 1 ? "s" : ""}${searchText ? ` for "${searchText}"` : ""}`}
          {activeTab === "listings" && (selectedCategories.length + selectedTypes.length > 0) && (
            <Text style={styles.activeFilterCount}> · {selectedCategories.length + selectedTypes.length} filter{selectedCategories.length + selectedTypes.length !== 1 ? "s" : ""}</Text>
          )}
        </Text>
        {activeTab === "listings" && (selectedCategories.length > 0 || selectedTypes.length > 0) && (
          <TouchableOpacity onPress={() => { setSelectedCategories([]); setSelectedTypes([]); }}>
            <Text style={styles.clearFilters}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent searches — shown when the box is empty */}
      {searchText.trim().length === 0 && searchHistory.length > 0 && (
        <View style={styles.historyBox}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent searches</Text>
            <TouchableOpacity onPress={clearAllHistory} activeOpacity={0.7}>
              <Text style={styles.historyClear}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyChips}>
            {searchHistory.map((term) => (
              <View key={term} style={styles.historyChip}>
                <TouchableOpacity
                  style={styles.historyChipMain}
                  activeOpacity={0.7}
                  onPress={() => { setSearchText(term); saveSearch(term); }}
                >
                  <Ionicons name="time-outline" size={14} color="#888" style={{ marginRight: 6 }} />
                  <Text style={styles.historyChipText}>{term}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.historyChipX} activeOpacity={0.7} onPress={() => removeSearch(term)}>
                  <Ionicons name="close" size={13} color="#aaa" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Listings grid */}
      {activeTab === "listings" && (
        loadingListings ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GREEN} size="large" />
            <Text style={styles.loadingText}>Searching listings...</Text>
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="search" size={38} color={GREEN} />
            </View>
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptySub}>Try a different search or filter</Text>
          </View>
        ) : (
          <FlatList
            data={filteredListings}
            keyExtractor={(item) => item.id}
            renderItem={renderListing}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* Sellers list */}
      {activeTab === "sellers" && (
        loadingSellers ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GREEN} size="large" />
            <Text style={styles.loadingText}>Searching sellers...</Text>
          </View>
        ) : filteredSellers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={38} color={GREEN} />
            </View>
            <Text style={styles.emptyTitle}>No sellers found</Text>
            <Text style={styles.emptySub}>Try a different name or email</Text>
          </View>
        ) : (
          <FlatList
            data={filteredSellers}
            keyExtractor={(item) => item.id}
            renderItem={renderSeller}
            contentContainerStyle={styles.sellerList}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT_BG, paddingTop: STATUSBAR_TOP },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E0E8DB" },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: "#E0E8DB" },
  searchInput: { flex: 1, fontSize: 15, color: "#222" },

  // Main tabs
  mainTabs: { flexDirection: "row", marginHorizontal: 14, marginBottom: 4, backgroundColor: "#E8EDE5", borderRadius: 12, padding: 4 },
  mainTab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 9 },
  mainTabActive: { backgroundColor: "#fff", elevation: 2 },
  mainTabText: { fontSize: 13, fontWeight: "600", color: "#999" },
  mainTabTextActive: { color: GREEN, fontWeight: "800" },

  // Filters
  filterScroll: { flexGrow: 0, flexShrink: 0, maxHeight: 52 },
  filtersRow: { paddingHorizontal: 14, paddingVertical: 8, gap: 8, alignItems: 'center' },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E0E8DB" },
  filterChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  filterEmoji: { fontSize: 13 },
  filterLabel: { fontSize: 12, fontWeight: "600", color: "#666" },
  filterLabelActive: { color: "#fff" },
  typeChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E0E8DB" },
  typeChipActive: { backgroundColor: "#E8F5EC", borderColor: GREEN },
  typeChipText: { fontSize: 12, fontWeight: "600", color: "#888" },
  typeChipTextActive: { color: GREEN, fontWeight: "700" },

  // Results header
  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  resultsCount: { fontSize: 13, color: "#999", fontWeight: "500" },
  activeFilterCount: { color: GREEN, fontWeight: "700" },
  clearFilters: { fontSize: 13, color: "#e74c3c", fontWeight: "600" },

  // Listings grid
  grid: { paddingHorizontal: 12, paddingBottom: 24 },
  row: { justifyContent: "space-between", marginBottom: 12 },
  card: { width: "48.5%", backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#E8EDE5", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardImageBox: { height: 130, alignItems: "center", justifyContent: "center", position: "relative" },
  cardImage: { width: "100%", height: "100%", position: "absolute" },
  cardEmoji: { fontSize: 44 },
  typeBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  typeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  cardInfo: { padding: 10, gap: 3 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a1a", lineHeight: 18 },
  cardPrice: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  cardLocation: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  cardLocationText: { fontSize: 11, color: "#aaa", flex: 1 },

  // Sellers list
  sellerList: { paddingHorizontal: 14, paddingBottom: 24 },
  sellerCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E8EDE5", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26, marginRight: 12 },
  sellerAvatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginRight: 12 },
  sellerAvatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },
  sellerInfo: { flex: 1 },
  sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  sellerName: { fontSize: 15, fontWeight: "700", color: "#111" },
  sellerEmail: { fontSize: 12, color: "#aaa", marginBottom: 4 },
  sellerRatingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sellerRatingText: { fontSize: 13, fontWeight: "700", color: "#333" },
  sellerReviewCount: { fontSize: 11, color: "#aaa" },

  // Loading
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 70 },
  loadingText: { marginTop: 14, fontSize: 13, color: "#999", fontWeight: "500" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIconBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#E8F5EC", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#333", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#aaa" },

  historyBox: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historyTitle: { fontSize: 14, fontWeight: '800', color: '#333' },
  historyClear: { fontSize: 13, color: '#e74c3c', fontWeight: '600' },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F4F0', borderRadius: 20, borderWidth: 1, borderColor: '#E4EBDE', overflow: 'hidden' },
  historyChipMain: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6, paddingVertical: 8 },
  historyChipText: { fontSize: 13, color: '#333', fontWeight: '600' },
  historyChipX: { paddingRight: 10, paddingLeft: 2, paddingVertical: 8 },
});
