import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Alert, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from "@expo/vector-icons/Ionicons";
import { updateProfile } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../firebaseConfig";
import { uploadFile } from "../utils/upload";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, RADIUS, SHADOWS, GRADIENTS, colorForName, FONTS } from "../constants/theme";

function StarRating({ rating, size = 14 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons key={star} name={star <= Math.round(rating) ? "star" : "star-outline"} size={size} color={star <= Math.round(rating) ? COLORS.star : COLORS.borderStrong} />
      ))}
    </View>
  );
}

function MenuItem({ icon, label, onPress, badge, last, color = COLORS.primary }) {
  return (
    <TouchableOpacity style={[styles.menuItem, !last && styles.menuItemBorder]} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge ? <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [listingCount, setListingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [userData, setUserData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const user = auth.currentUser;
  const isAdmin = userData?.role === "admin";

  const loadUserData = async () => {
    if (!user?.uid) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      setProfilePhoto(data?.photoURL || user?.photoURL || null);
      setUserData(data);
    } catch (e) {}
  };

  const loadListingCount = async () => {
    if (!auth.currentUser) return; // signing out: the screen may still refresh once
    try {
      const snapshot = await getDocs(query(collection(db, "listings"), where("sellerId", "==", user.uid)));
      setListingCount(snapshot.size);
    } catch (e) {
      // Permission errors happen briefly while signing out; anything else is worth logging.
      if (e.code !== "permission-denied") console.log("Profile listings error:", e.message);
    }
  };

  const loadCartCount = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "cart"));
      setCartCount(snapshot.size);
    } catch (e) {}
  };

  const loadReviews = async () => {
    try {
      const snap = await getDocs(query(collection(db, "reviews"), where("sellerId", "==", user.uid)));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      setReviews(items);
    } catch (e) { console.log("Reviews load error:", e.message); }
  };

  const loadFollowers = async () => {
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "followers"));
      setFollowerCount(snap.size);
    } catch (e) {}
  };

  const loadAll = () => Promise.all([loadUserData(), loadListingCount(), loadCartCount(), loadReviews(), loadFollowers()]);

  useEffect(() => {
    loadAll();
    return navigation.addListener("focus", () => { loadListingCount(); loadCartCount(); loadFollowers(); });
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleChangePhoto = () => {
    Alert.alert("Change Profile Photo", "Choose an option", [
      { text: "📷 Take Photo", onPress: () => pickImage("camera") },
      { text: "🖼️ Choose from Gallery", onPress: () => pickImage("gallery") },
      profilePhoto ? { text: "Remove Photo", style: "destructive", onPress: removePhoto } : null,
      { text: "Cancel", style: "cancel" },
    ].filter(Boolean));
  };

  const pickImage = async (source) => {
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert("Permission required"); return; }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
    } catch (e) { Alert.alert("Error", "Could not open camera/gallery."); }
  };

  const uploadPhoto = async (uri) => {
    setUploadingPhoto(true);
    try {
      const downloadURL = await uploadFile(uri, `profiles/${user.uid}/avatar.jpg`, { maxSize: 600 });
      await updateProfile(user, { photoURL: downloadURL });
      await updateDoc(doc(db, "users", user.uid), { photoURL: downloadURL });
      setProfilePhoto(downloadURL);
      Alert.alert("✅ Updated", "Profile photo updated!");
    } catch (e) { Alert.alert("Error", "Failed to upload photo."); }
    finally { setUploadingPhoto(false); }
  };

  const removePhoto = async () => {
    await updateProfile(user, { photoURL: null });
    await updateDoc(doc(db, "users", user.uid), { photoURL: null });
    setProfilePhoto(null);
  };

  async function cancelFacultyRequest() {
    Alert.alert("Cancel request?", "This will withdraw your faculty verification request.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: async () => {
          await updateDoc(doc(db, "users", user.uid), { facultyRequest: "none" });
          setUserData((prev) => ({ ...prev, facultyRequest: "none" }));
        },
      },
    ]);
  }

  async function requestFacultyStatus() {
    await updateDoc(doc(db, "users", user.uid), { facultyRequest: "pending" });
    setUserData((prev) => ({ ...prev, facultyRequest: "pending" }));
    Alert.alert("Requested", "Your faculty status request was sent for review.");
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : userData?.avgRating || 0;

  const isVerified = userData?.verificationStatus === "verified";

  return (
    <View style={styles.safe}>
      {isFocused && <StatusBar barStyle="light-content" />}
      {/* Keeps the area behind the status bar green even after the header scrolls away */}
      <View pointerEvents="none" style={[styles.statusBacking, { height: insets.top }]} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── GREEN HEADER ── */}
        <LinearGradient colors={GRADIENTS.primaryDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroCircle} />
          <View style={styles.heroCircleSmall} />
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>Profile</Text>
            <TouchableOpacity style={styles.heroIconBtn} onPress={() => navigation.navigate("Settings")}>
              <Ionicons name="settings-outline" size={21} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── PROFILE CARD ── */}
        <View style={styles.profileCard}>
          <View style={styles.identityRow}>
            <TouchableOpacity style={styles.avatarWrapper} activeOpacity={0.85} onPress={handleChangePhoto}>
              {uploadingPhoto ? (
                <View style={styles.avatarFallback}><ActivityIndicator color={COLORS.primary} /></View>
              ) : profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{user?.displayName?.[0]?.toUpperCase() || "?"}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{user?.displayName || "Student"}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
              <View style={styles.badgesRow}>
                {isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
                    <Text style={styles.verifiedText}>Verified SLSU Student</Text>
                  </View>
                )}
                {userData?.role === "faculty" && (
                  <View style={[styles.verifiedBadge, { backgroundColor: COLORS.accentLight }]}>
                    <Ionicons name="briefcase" size={12} color="#8A5A00" />
                    <Text style={[styles.verifiedText, { color: "#8A5A00" }]}>Faculty</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {userData?.role !== "faculty" && userData?.facultyRequest === "pending" && (
            <TouchableOpacity style={[styles.notice, { backgroundColor: COLORS.warningLight }]} activeOpacity={0.8} onPress={cancelFacultyRequest}>
              <Ionicons name="time-outline" size={15} color={COLORS.warning} />
              <Text style={[styles.noticeText, { color: COLORS.warning }]}>Faculty verification pending · Tap to cancel</Text>
            </TouchableOpacity>
          )}
          {userData?.role !== "faculty" && userData?.facultyRequest === "rejected" && (
            <TouchableOpacity style={[styles.notice, { backgroundColor: COLORS.errorLight }]} activeOpacity={0.8} onPress={requestFacultyStatus}>
              <Ionicons name="close-circle-outline" size={15} color={COLORS.error} />
              <Text style={[styles.noticeText, { color: COLORS.error }]}>Faculty request declined · Request again</Text>
            </TouchableOpacity>
          )}
          {userData && !isVerified && !isAdmin && (
            <TouchableOpacity style={[styles.notice, { backgroundColor: COLORS.primaryPale }]} activeOpacity={0.8} onPress={() => navigation.navigate("Verification")}>
              <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.primary} />
              <Text style={[styles.noticeText, { color: COLORS.primary }]}>
                {userData?.verificationStatus === "pending" ? "Student ID verification pending review" : "Verify your student ID to start selling"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            {[
              { label: "Listings", value: listingCount, color: COLORS.primary },
              { label: "Rating", value: avgRating > 0 ? avgRating.toFixed(1) : "—", color: "#F59E0B" },
              { label: "Reviews", value: reviews.length, color: "#2563EB" },
              { label: "Followers", value: followerCount, color: "#7C3AED", onPress: () => navigation.navigate("Following") },
            ].map((stat, i) => (
              <TouchableOpacity key={stat.label} style={[styles.statItem, i > 0 && styles.statDivider]} activeOpacity={stat.onPress ? 0.7 : 1} onPress={stat.onPress}>
                <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── MENU ── */}
        <View style={styles.menu}>
          <MenuItem icon="pricetags" color="#16A34A" label="My Listings" onPress={() => navigation.navigate("MyListings")} />
          <MenuItem icon="cart" color="#F59E0B" label="My Cart" badge={cartCount > 0 ? cartCount : null} onPress={() => navigation.navigate("Cart")} />
          <MenuItem icon="chatbubble-ellipses" color="#2563EB" label="Messages" onPress={() => navigation.navigate("Main", { screen: "Messages" })} />
          <MenuItem icon="people" color="#7C3AED" label="Followers & Following" onPress={() => navigation.navigate("Following")} />
          <MenuItem icon="notifications" color="#E11D48" label="Notifications" onPress={() => navigation.navigate("Notifications")} />
          {isAdmin && <MenuItem icon="key" color="#0D9488" label="Admin Panel" onPress={() => navigation.navigate("AdminPanel")} />}
          <MenuItem icon="settings" color="#64748B" label="Settings" onPress={() => navigation.navigate("Settings")} />
          <MenuItem icon="help-circle" color="#EA580C" label="Help & About" onPress={() => navigation.navigate("About")} last />
        </View>

        {/* ── REVIEWS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={26} color={COLORS.textMuted} />
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
            </View>
          ) : (
            reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewAvatar, { backgroundColor: colorForName(review.reviewerName) }]}>
                    <Text style={styles.reviewAvatarText}>{review.reviewerName?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                    <StarRating rating={review.rating} size={12} />
                  </View>
                  <Text style={styles.reviewDate}>{review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : "Recently"}</Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBacking: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: COLORS.primaryDark },
  safe: { flex: 1, backgroundColor: COLORS.background },

  hero: { paddingHorizontal: SPACING.lg, paddingBottom: 64, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroCircle: { position: "absolute", right: -60, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.10)" },
  heroCircleSmall: { position: "absolute", left: -30, bottom: -50, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(245,158,11,0.18)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTitle: { fontSize: 22, fontFamily: FONTS.heading, color: "#fff" },
  heroIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },

  profileCard: { marginHorizontal: SPACING.lg, marginTop: -48, backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.lg, ...SHADOWS.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrapper: { position: "relative" },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 30, fontFamily: FONTS.heading, color: COLORS.primary },
  cameraBadge: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  userName: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  userEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 9, paddingVertical: 4 },
  verifiedText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14 },
  noticeText: { flex: 1, fontSize: 12.5, fontWeight: "600" },

  statsRow: { flexDirection: "row", marginTop: SPACING.lg, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  statNumber: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  statLabel: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 },

  menu: { marginHorizontal: SPACING.lg, marginTop: SPACING.lg, backgroundColor: COLORS.white, borderRadius: 18, paddingHorizontal: SPACING.lg, ...SHADOWS.sm },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: "500" },
  menuBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  menuBadgeText: { color: "#fff", fontSize: 11, fontFamily: FONTS.heading },

  section: { marginHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionTitle: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: SPACING.md },
  emptyReviews: { alignItems: "center", paddingVertical: 24, gap: 6, backgroundColor: COLORS.white, borderRadius: 16 },
  emptyReviewsText: { fontSize: 13, color: COLORS.textMuted },
  reviewCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 10 },
  reviewAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  reviewerName: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 2 },
  reviewDate: { fontSize: 10.5, color: COLORS.textMuted },
  reviewComment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
});
