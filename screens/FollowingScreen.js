import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, RADIUS, colorForName } from "../constants/theme";

const GREEN = COLORS.primary;

export default function FollowingScreen({ navigation }) {
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  const loadFollowing = async () => {
    if (!user?.uid) { setLoading(false); return; }
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "following"));
      // Enrich each followed seller with their latest profile info
      const items = await Promise.all(
        snap.docs.map(async (d) => {
          const base = { id: d.id, ...d.data() };
          try {
            const sellerDoc = await getDoc(doc(db, "users", base.uid || d.id));
            if (sellerDoc.exists()) {
              const data = sellerDoc.data();
              return {
                ...base,
                name: data.name || base.name || "Student",
                photoURL: data.photoURL || null,
                email: data.email || "",
                avgRating: data.avgRating || 0,
                verificationStatus: data.verificationStatus || null,
              };
            }
          } catch (e) {}
          return base;
        })
      );
      // Newest follows first
      items.sort((a, b) => (b.followedAt?.toDate?.() || 0) - (a.followedAt?.toDate?.() || 0));
      setFollowing(items);
    } catch (e) {
      console.log("Following load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadFollowing(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadFollowing);
    return unsub;
  }, [navigation]);

  const onRefresh = () => { setRefreshing(true); loadFollowing(); };

  const renderSeller = ({ item }) => {
    const initial = item.name?.[0]?.toUpperCase() || "?";
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("SellerProfile", { sellerId: item.uid || item.id, sellerName: item.name })}
      >
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: colorForName(item.name) }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            {item.verificationStatus === "verified" && (
              <Ionicons name="checkmark-circle" size={14} color={GREEN} />
            )}
          </View>
          {item.email ? <Text style={styles.email} numberOfLines={1}>{item.email}</Text> : null}
          {item.avgRating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F4C542" />
              <Text style={styles.ratingText}>{item.avgRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title="Following"
        subtitle={following.length > 0 ? `${following.length} seller${following.length !== 1 ? "s" : ""}` : null}
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Profile" }); }}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={GREEN} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : following.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="people-outline" size={44} color={GREEN} />
          </View>
          <Text style={styles.emptyTitle}>Not following anyone yet</Text>
          <Text style={styles.emptySub}>
            When you follow a seller, they'll show up here so you can quickly check their listings.
          </Text>
          <TouchableOpacity style={styles.browseBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Search")}>
            <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.browseBtnText}>Find Sellers</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          renderItem={renderSeller}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 13, color: COLORS.textMuted, fontWeight: "500" },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  email: { fontSize: 12, color: COLORS.textMuted, marginBottom: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 12.5, fontWeight: "700", color: COLORS.textSecondary },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: RADIUS.md, paddingHorizontal: 26, paddingVertical: 14 },
  browseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
