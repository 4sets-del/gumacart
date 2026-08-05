import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator, RefreshControl, Alert, Image, Platform,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";

const TYPE_COLORS = { sell: GREEN, buy: "#2980b9", barter: "#e67e22", donate: "#e74c3c" };
const TYPE_LABELS = { sell: "FOR SALE", buy: "WANTED", barter: "BARTER", donate: "FREE" };

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  const loadCart = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "cart"));
      setCartItems(snapshot.docs.map((d) => ({ cartDocId: d.id, ...d.data() })));
    } catch (e) {
      console.log("CartScreen load error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCart(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadCart(); setRefreshing(false); };

  const removeFromCart = async (cartDocId) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "cart", cartDocId));
      setCartItems((prev) => prev.filter((item) => item.cartDocId !== cartDocId));
    } catch (e) { Alert.alert("Error", "Could not remove item. Please try again."); }
  };

  const clearCart = () => {
    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: async () => {
        try {
          await Promise.all(cartItems.map((item) => deleteDoc(doc(db, "users", user.uid, "cart", item.cartDocId))));
          setCartItems([]);
        } catch (e) { Alert.alert("Error", "Could not clear cart."); }
      }},
    ]);
  };

  const viewProduct = async (item) => {
    try {
      const snap = await getDoc(doc(db, "listings", item.listingId));
      if (snap.exists()) {
        navigation.navigate("ProductDetail", { product: { id: snap.id, ...snap.data() } });
      } else {
        Alert.alert("Listing Unavailable", "This listing may have been removed.");
      }
    } catch (e) { Alert.alert("Error", "Could not open this listing."); }
  };

  const renderPriceLabel = (item) => {
    if (item.type === "donate") return <Text style={[styles.itemPrice, { color: "#e74c3c" }]}>FREE</Text>;
    if (item.type === "barter") return <Text style={[styles.itemPrice, { color: "#e67e22" }]}>For Barter</Text>;
    if (item.type === "buy")    return <Text style={[styles.itemPrice, { color: "#2980b9" }]}>Looking For</Text>;
    return <Text style={styles.itemPrice}>₱{item.price != null ? item.price.toLocaleString() : "—"}</Text>;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Home"); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cartItems.length > 0 ? (
          <TouchableOpacity onPress={clearCart} activeOpacity={0.7} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={styles.body}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={GREEN} size="large" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIcon}>🛒</Text>
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Tap the 🛍️ icon on any listing to save it here</Text>
          <TouchableOpacity style={styles.browseBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Home")}>
            <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.browseBtnText}>Browse Listings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        >
          <Text style={styles.itemCount}>{cartItems.length} saved item{cartItems.length !== 1 ? "s" : ""}</Text>

          {cartItems.map((item) => (
            <TouchableOpacity key={item.cartDocId} style={styles.card} onPress={() => viewProduct(item)} activeOpacity={0.9}>
              <View style={styles.imageBox}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.itemImage} />
                ) : (
                  <Text style={styles.imagePlaceholder}>🛍️</Text>
                )}
                <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] || GREEN }]}>
                  <Text style={styles.typeBadgeText}>{TYPE_LABELS[item.type] || "FOR SALE"}</Text>
                </View>
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                {renderPriceLabel(item)}
                <View style={styles.itemMetaRow}>
                  <Ionicons name="location-sharp" size={11} color="#aaa" />
                  <Text style={styles.itemLocation} numberOfLines={1}>{item.location}</Text>
                </View>
                <Text style={styles.itemAdded}>
                  Added {item.addedAt?.toDate ? item.addedAt.toDate().toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "recently"}
                </Text>
              </View>

              <TouchableOpacity style={styles.removeBtn} activeOpacity={0.6} onPress={() => removeFromCart(item.cartDocId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color="#D5D5D5" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          <View style={styles.hintBox}>
            <Text style={styles.hintIcon}>💡</Text>
            <Text style={styles.hintText}>Tap any item to view the full listing and message the seller.</Text>
          </View>
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN, paddingTop: STATUSBAR_TOP },
  body: { flex: 1, backgroundColor: LIGHT_BG },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: GREEN },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  clearAllBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20 },
  clearAllText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 13, color: "#999", fontWeight: "500" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 22, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#222", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  browseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 15, elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  browseBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  itemCount: { fontSize: 13, color: "#999", marginBottom: 14, fontWeight: "500" },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#EAEAEA", marginBottom: 12, overflow: "hidden", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  imageBox: { width: 100, height: 100, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", position: "relative" },
  itemImage: { width: 100, height: 100 },
  imagePlaceholder: { fontSize: 40 },
  typeBadge: { position: "absolute", top: 8, left: 8, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  typeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  itemInfo: { flex: 1, padding: 12, justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 5, lineHeight: 19 },
  itemPrice: { fontSize: 15, fontWeight: "800", color: GREEN, marginBottom: 5 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 3 },
  itemLocation: { fontSize: 11, color: "#aaa", flex: 1 },
  itemAdded: { fontSize: 10, color: "#ccc" },
  removeBtn: { paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  hintBox: { flexDirection: "row", alignItems: "flex-start", marginTop: 10, backgroundColor: "#E8F5EC", borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: "#C8E6D0" },
  hintIcon: { fontSize: 15 },
  hintText: { fontSize: 13, color: GREEN, lineHeight: 18, flex: 1, fontWeight: "500" },
});
