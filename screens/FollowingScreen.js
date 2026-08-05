import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Image, FlatList, RefreshControl, Platform,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";

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
          <View style={styles.avatarCircle}>
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
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Profile"); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>Following</Text>
          {following.length > 0 && <Text style={styles.headerSub}>{following.length} seller{following.length !== 1 ? "s" : ""}</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

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
          style={{ backgroundColor: LIGHT_BG }}
          data={following}
          keyExtractor={(item) => item.id}
          renderItem={renderSeller}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: GREEN },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600", marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 13, color: "#999", fontWeight: "500" },

  list: { padding: 16 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E8EDE5", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 12 },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  name: { fontSize: 15, fontWeight: "700", color: "#111" },
  email: { fontSize: 12, color: "#aaa", marginBottom: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13, fontWeight: "700", color: "#333" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#E8F5EC", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#333", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 16, paddingHorizontal: 26, paddingVertical: 14, elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  browseBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
