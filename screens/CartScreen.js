import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Alert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import { collection, getDocs, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { Image as CachedImage } from "expo-image";
import { SPACING, RADIUS, FONTS, colorForName } from "../constants/theme";
import Sheet from "../components/Sheet";
import { useTheme } from '../context/ThemeContext';
import GradientButton from "../components/GradientButton";
import { listingImage, priceLabel } from "../constants/listings";
import { startConversation } from "../utils/chat";

const peso = (n) => `₱${Number(n).toLocaleString()}`;

export default function CartScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [sellerPickerVisible, setSellerPickerVisible] = useState(false);
  const user = auth.currentUser;

  const loadCart = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "cart"));
      // Older cart entries don't store the photo or seller, and listings can be
      // sold or removed since they were added, so refresh from the listing.
      const items = await Promise.all(snapshot.docs.map(async (d) => {
        const item = { cartDocId: d.id, quantity: 1, ...d.data() };
        try {
          const listing = await getDoc(doc(db, "listings", item.listingId || d.id));
          if (!listing.exists()) return { ...item, unavailable: true };
          const data = listing.data();
          return {
            ...item,
            image: item.image || listingImage(data),
            sellerId: data.sellerId,
            sellerName: data.sellerName || item.sellerName || "Seller",
            price: data.price ?? item.price,
            stock: Math.max(1, Number(data.quantity) || 1),
            unavailable: data.status !== "active",
          };
        } catch (e) {
          return item;
        }
      }));
      setCartItems(items);
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

  const changeQuantity = async (item, delta) => {
    // Can't ask for more than the seller has.
    const quantity = Math.max(1, Math.min(item.stock || 1, (item.quantity || 1) + delta));
    if (quantity === item.quantity) return;
    setCartItems((prev) => prev.map((i) => (i.cartDocId === item.cartDocId ? { ...i, quantity } : i)));
    try { await updateDoc(doc(db, "users", user.uid, "cart", item.cartDocId), { quantity }); } catch (e) {}
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
      const snap = await getDoc(doc(db, "listings", item.listingId || item.cartDocId));
      if (snap.exists()) {
        navigation.navigate("ProductDetail", { product: { id: snap.id, ...snap.data() } });
      } else {
        Alert.alert("Listing Unavailable", "This listing may have been removed.");
      }
    } catch (e) { Alert.alert("Error", "Could not open this listing."); }
  };

  const available = cartItems.filter((i) => !i.unavailable && i.sellerId && i.sellerId !== user.uid);
  const isPriced = (i) => (i.type || "sell") === "sell" && typeof i.price === "number";
  const subtotal = available.filter(isPriced).reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);

  const sellers = Object.values(available.reduce((acc, i) => {
    acc[i.sellerId] = acc[i.sellerId] || { sellerId: i.sellerId, sellerName: i.sellerName, items: [] };
    acc[i.sellerId].items.push(i);
    return acc;
  }, {}));

  // "Checkout" sends the seller an order message and opens the chat, where
  // buyer and seller agree on a meet-up.
  const checkoutWith = async (seller) => {
    setSellerPickerVisible(false);
    setCheckingOut(true);
    try {
      const lines = seller.items.map((i) => {
        const qty = i.quantity || 1;
        const priceText = isPriced(i) ? ` — ${peso(i.price * qty)}` : ` (${priceLabel(i).text})`;
        return `• ${i.name} ×${qty}${priceText}`;
      });
      const total = seller.items.filter(isPriced).reduce((s, i) => s + i.price * (i.quantity || 1), 0);
      const text = [
        "🛒 Hi! I'd like to get these items:",
        ...lines,
        total > 0 ? `Total: ${peso(total)}` : null,
        "When and where can we meet?",
      ].filter(Boolean).join("\n");
      const conversationId = await startConversation(user, seller.sellerId, text);
      navigation.navigate("Chat", { conversationId, otherUserId: seller.sellerId, otherUserName: seller.sellerName, listingName: null });
    } catch (e) {
      Alert.alert("Error", "Could not contact the seller. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  const proceedToCheckout = () => {
    if (sellers.length === 0) {
      Alert.alert("Nothing to check out", "The items in your cart are no longer available.");
    } else if (sellers.length === 1) {
      checkoutWith(sellers[0]);
    } else {
      setSellerPickerVisible(true);
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle={COLORS.statusBar} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Home" }); }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cartItems.length > 0 ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear cart" onPress={clearCart} activeOpacity={0.7} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="cart-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add items from any listing to save them here.</Text>
          <TouchableOpacity style={styles.browseBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Main", { screen: "Home" })}>
            <Text style={styles.browseBtnText}>Browse Listings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 20 }}
          >
            {cartItems.map((item) => {
              const price = priceLabel(item);
              return (
                <TouchableOpacity key={item.cartDocId} style={styles.row} onPress={() => viewProduct(item)} activeOpacity={0.9}>
                  <View style={styles.imageBox}>
                    {item.image ? (
                      <CachedImage source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                    ) : (
                      <Text style={{ fontSize: 30 }}>🛍️</Text>
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from cart`} onPress={() => removeFromCart(item.cartDocId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.itemPrice, { color: price.color }]}>{price.text}</Text>
                    {item.unavailable ? (
                      <Text style={styles.unavailable}>No longer available</Text>
                    ) : (
                      <View style={styles.stepper}>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease quantity" style={styles.stepBtn} onPress={() => changeQuantity(item, -1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.qty}>{item.quantity || 1}</Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase quantity" style={styles.stepBtn} onPress={() => changeQuantity(item, 1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>{peso(subtotal)}</Text>
            </View>
            <GradientButton title="Proceed to Checkout" icon="bag-check-outline" onPress={proceedToCheckout} loading={checkingOut} />
            <Text style={styles.footerHint}>You'll chat with the seller to arrange payment and meet-up.</Text>
          </View>
        </>
      )}

      {/* Cart has items from more than one seller: pick who to contact */}
      <Sheet
        visible={sellerPickerVisible}
        onClose={() => setSellerPickerVisible(false)}
        title="Choose a seller"
        subtitle={`Your cart has items from ${sellers.length} sellers. Check out with one at a time.`}
        icon="storefront"
        footer={null}
      >
        <View style={styles.sellerList}>
          {sellers.map((s) => {
            const total = s.items.filter(isPriced).reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
            return (
              <TouchableOpacity key={s.sellerId} style={styles.sellerRow} activeOpacity={0.8} onPress={() => checkoutWith(s)}>
                <View style={[styles.sellerAvatar, { backgroundColor: colorForName(s.sellerName) }]}><Text style={styles.sellerAvatarText}>{s.sellerName?.[0]?.toUpperCase() || "?"}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerName} numberOfLines={1}>{s.sellerName}</Text>
                  <Text style={styles.sellerMeta}>{s.items.length} item{s.items.length !== 1 ? "s" : ""}{total > 0 ? ` · ${peso(total)}` : ""}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginLeft: 4 },

  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconBox: { width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 19, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 28, paddingVertical: 14 },
  browseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  row: { flexDirection: "row", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  imageBox: { width: 84, height: 84, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  itemImage: { width: "100%", height: "100%" },
  itemInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemName: { flex: 1, fontSize: 14.5, fontWeight: "600", color: COLORS.textPrimary, lineHeight: 20 },
  itemPrice: { fontSize: 15, fontFamily: FONTS.heading, marginTop: 4 },
  unavailable: { fontSize: 12.5, color: COLORS.error, fontWeight: "600", marginTop: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  qty: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary, minWidth: 14, textAlign: "center" },

  footer: { paddingHorizontal: SPACING.lg, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  subtotalLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: "500" },
  subtotalValue: { fontSize: 18, color: COLORS.textPrimary, fontFamily: FONTS.heading },
  footerHint: { fontSize: 11.5, color: COLORS.textMuted, textAlign: "center", marginTop: 8 },

  sellerList: { marginTop: 10, gap: 8 },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sellerAvatarText: { color: "#fff", fontFamily: FONTS.heading, fontSize: 16 },
  sellerName: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  sellerMeta: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 2 },
});
