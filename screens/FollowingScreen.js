import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, RefreshControl, 
} from 'react-native';
import { Alert } from '../components/AppAlert';
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ScreenHeader from "../components/ScreenHeader";
import { RADIUS, colorForName, FONTS } from "../constants/theme";
import { useTheme } from '../context/ThemeContext';
import { getUserBasics } from "../utils/userCache";


// Followers / Following lists for the signed-in user. Opened from Profile
// (`initialTab: "followers"` from the Followers stat, "following" otherwise).
export default function FollowingScreen({ navigation, route }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [tab, setTab] = useState(route?.params?.initialTab === "followers" ? "followers" : "following");
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const user = auth.currentUser;

  // Each list doc only stores the other person's id/name; current name,
  // photo and rating come from the shared profile cache.
  const loadList = async (sub) => {
    const snap = await getDocs(collection(db, "users", user.uid, sub));
    const items = await Promise.all(snap.docs.map(async (d) => {
      const base = { id: d.id, ...d.data() };
      const profile = await getUserBasics(base.uid || d.id);
      return { ...base, ...profile, name: profile.name !== "Unknown" ? profile.name : base.name || "Student" };
    }));
    return items.sort((a, b) => (b.followedAt?.toMillis?.() || 0) - (a.followedAt?.toMillis?.() || 0));
  };

  const load = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return; }
    try {
      const [ing, ers] = await Promise.all([loadList("following"), loadList("followers")]);
      setFollowing(ing);
      setFollowers(ers);
    } catch (e) {
      console.log("Follow lists error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => navigation.addListener("focus", load), [navigation, load]);
  useEffect(() => { load(); }, [load]);

  const followingIds = new Set(following.map((f) => f.uid || f.id));

  const unfollow = (person) => {
    const otherId = person.uid || person.id;
    Alert.alert("Unfollow", `Stop following ${person.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unfollow", style: "destructive", onPress: async () => {
        setBusyId(otherId);
        try {
          await Promise.all([
            deleteDoc(doc(db, "users", user.uid, "following", otherId)),
            deleteDoc(doc(db, "users", otherId, "followers", user.uid)),
          ]);
          setFollowing((prev) => prev.filter((f) => (f.uid || f.id) !== otherId));
        } catch (e) { Alert.alert("Error", "Could not unfollow. Please try again."); }
        finally { setBusyId(null); }
      }},
    ]);
  };

  const followBack = async (person) => {
    const otherId = person.uid || person.id;
    setBusyId(otherId);
    try {
      await Promise.all([
        setDoc(doc(db, "users", otherId, "followers", user.uid), {
          uid: user.uid, name: user.displayName || "Anonymous", followedAt: serverTimestamp(),
        }),
        setDoc(doc(db, "users", user.uid, "following", otherId), {
          uid: otherId, name: person.name, followedAt: serverTimestamp(),
        }),
      ]);
      setFollowing((prev) => [{ ...person, id: otherId, uid: otherId }, ...prev]);
    } catch (e) { Alert.alert("Error", "Could not follow. Please try again."); }
    finally { setBusyId(null); }
  };

  const renderPerson = ({ item }) => {
    const otherId = item.uid || item.id;
    const iFollow = followingIds.has(otherId);
    const busy = busyId === otherId;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("SellerProfile", { sellerId: otherId, sellerName: item.name })}
      >
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatar} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: colorForName(item.name) }]}>
            <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || "?"}</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {item.verificationStatus === "verified" && <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />}
          </View>
          {item.avgRating > 0 ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.star} />
              <Text style={styles.ratingText}>{item.avgRating.toFixed(1)}</Text>
            </View>
          ) : item.email ? <Text style={styles.email} numberOfLines={1}>{item.email}</Text> : null}
        </View>
        {busy ? (
          <ActivityIndicator color={COLORS.primary} style={{ width: 92 }} />
        ) : iFollow ? (
          <TouchableOpacity style={styles.unfollowBtn} activeOpacity={0.8} onPress={() => unfollow(item)}>
            <Text style={styles.unfollowText}>Following</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.followBtn} activeOpacity={0.85} onPress={() => followBack(item)}>
            <Ionicons name="person-add" size={13} color="#fff" />
            <Text style={styles.followText}>Follow back</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const list = tab === "following" ? following : followers;

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title="Connections"
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Profile" }); }}
      />

      <View style={styles.segment}>
        {[["followers", `Followers (${followers.length})`], ["following", `Following (${following.length})`]].map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.segmentItem, tab === id && styles.segmentItemOn]} activeOpacity={0.85} onPress={() => setTab(id)}>
            <Text style={[styles.segmentText, tab === id && styles.segmentTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : list.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name={tab === "following" ? "people-outline" : "heart-outline"} size={42} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>{tab === "following" ? "Not following anyone yet" : "No followers yet"}</Text>
          <Text style={styles.emptySub}>
            {tab === "following"
              ? "Follow sellers to quickly check their new listings."
              : "Post listings and stay active. People who follow you will appear here."}
          </Text>
          {tab === "following" && (
            <TouchableOpacity style={styles.browseBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Search")}>
              <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.browseBtnText}>Find Sellers</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={renderPerson}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        />
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },

  segment: { flexDirection: "row", marginHorizontal: 16, marginBottom: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: RADIUS.full },
  segmentItemOn: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 13.5, fontWeight: "600", color: COLORS.textSecondary },
  segmentTextOn: { color: "#fff", fontWeight: "700" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText: { fontSize: 20, fontFamily: FONTS.heading, color: "#fff" },
  info: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, flexShrink: 1 },
  email: { fontSize: 12, color: COLORS.textMuted },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 12.5, fontWeight: "700", color: COLORS.textSecondary },

  unfollowBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  unfollowText: { fontSize: 12.5, fontWeight: "700", color: COLORS.textSecondary },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  followText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 8, textAlign: "center" },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 26, paddingVertical: 14 },
  browseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
