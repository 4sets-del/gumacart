import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Alert, ActivityIndicator,
  RefreshControl, Image, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { signOut, updateProfile } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";
const SCREEN_WIDTH = Dimensions.get("window").width;

const TYPE_COLORS = { sell: GREEN, buy: "#2980b9", barter: "#e67e22", donate: "#e74c3c" };
const TYPE_LABELS = { sell: "FOR SALE", buy: "WANTED", barter: "BARTER", donate: "FREE" };

function StarRating({ rating, size = 14 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons key={star} name={star <= Math.round(rating) ? "star" : "star-outline"} size={size} color={star <= Math.round(rating) ? "#F4C542" : "#D5D5D5"} />
      ))}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [cartCount, setCartCount] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [userData, setUserData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.uid) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      setIsAdmin(data?.role === "admin");
      setProfilePhoto(data?.photoURL || user?.photoURL || null);
      setUserData(data);
    };
    loadUserData();
  }, []);

  const loadMyListings = async () => {
    try {
      const q = query(collection(db, "listings"), where("sellerId", "==", user.uid), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setListings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log("Profile listings error:", e.message); }
    finally { setLoading(false); }
  };

  const loadCartCount = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "cart"));
      setCartCount(snapshot.size);
    } catch (e) {}
  };

  const loadReviews = async () => {
    try {
      const q = query(collection(db, "reviews"), where("sellerId", "==", user.uid));
      const snap = await getDocs(q);
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

  useEffect(() => { loadMyListings(); loadCartCount(); loadReviews(); loadFollowers(); }, []);
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => { loadCartCount(); loadFollowers(); });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyListings(); await loadCartCount(); await loadReviews(); await loadFollowers();
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
      const storageRef = ref(storage, `profiles/${user.uid}/avatar.jpg`);
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
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

  const getListingImage = (item) => {
    if (item.images?.length > 0) return item.images[0];
    if (item.image) return item.image;
    return null;
  };

  const filteredListings = listings.filter((l) =>
    activeTab === "active" ? l.status !== "sold" : l.status === "sold"
  );

  const totalListings = listings.length;
  const activeSell = listings.filter((l) => l.type === "sell" && l.status !== "sold").length;
  const activeBarter = listings.filter((l) => l.type === "barter").length;
  const activeDonate = listings.filter((l) => l.type === "donate").length;

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : userData?.avgRating || 0;

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star, count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => navigation.navigate("Home")}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")} activeOpacity={0.7} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ backgroundColor: LIGHT_BG }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}>

        <View style={styles.profileHero}>
          <TouchableOpacity style={styles.avatarWrapper} activeOpacity={0.85} onPress={handleChangePhoto}>
            {uploadingPhoto ? (
              <View style={styles.avatarCircle}><ActivityIndicator color="#fff" size="large" /></View>
            ) : profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{user?.displayName?.[0]?.toUpperCase() || "?"}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={15} color={GREEN} />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.displayName || "Student"}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          {userData?.role === "faculty" && (
            <View style={styles.facultyBadge}>
              <Ionicons name="briefcase" size={13} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.facultyText}>Faculty</Text>
            </View>
          )}

          {userData?.role !== "faculty" && userData?.facultyRequest === "pending" && (
            <TouchableOpacity style={styles.facultyPending} activeOpacity={0.8} onPress={cancelFacultyRequest}>
              <Ionicons name="time-outline" size={13} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.facultyPendingText}>Faculty verification pending · Cancel</Text>
            </TouchableOpacity>
          )}

          {userData?.role !== "faculty" && userData?.facultyRequest === "rejected" && (
            <TouchableOpacity style={styles.facultyRejected} activeOpacity={0.8} onPress={requestFacultyStatus}>
              <Ionicons name="close-circle-outline" size={13} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.facultyPendingText}>Faculty request declined · Request again</Text>
            </TouchableOpacity>
          )}

          {reviews.length > 0 && (
            <View style={styles.heroRatingRow}>
              <StarRating rating={avgRating} size={15} />
              <Text style={styles.heroRatingText}>{avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})</Text>
            </View>
          )}
          <TouchableOpacity style={styles.followerPill} activeOpacity={0.8} onPress={() => navigation.navigate("Following")}>
            <Ionicons name="people" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.followerPillText}>{followerCount} follower{followerCount !== 1 ? "s" : ""}</Text>
          </TouchableOpacity>
          {userData?.verificationStatus === "verified" && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.verifiedText}>SLSU Verified Student</Text>
            </View>
          )}
        </View>

        <View style={styles.statsCard}>
          {[
            { label: "Total Posts", value: totalListings, color: "#111" },
            { label: "Selling",     value: activeSell,    color: GREEN },
            { label: "Barter",      value: activeBarter,  color: "#e67e22" },
            { label: "Donate",      value: activeDonate,  color: "#e74c3c" },
          ].map((stat, i, arr) => (
            <View key={stat.label} style={{ flex: 1, flexDirection: "row" }}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </View>
          ))}
        </View>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => navigation.navigate("Following")}>
            <Ionicons name="people" size={20} color={GREEN} />
            <Text style={styles.quickActionLabel}>Following</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.quickActionBtn} activeOpacity={0.8} onPress={() => navigation.navigate("AdminPanel")}>
              <Text style={styles.quickActionIcon}>🔑</Text>
              <Text style={styles.quickActionLabel}>Admin Panel</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
          <View style={styles.ratingSummaryCard}>
            <View style={styles.ratingSummaryLeft}>
              <Text style={styles.ratingBigNum}>{avgRating > 0 ? avgRating.toFixed(1) : "—"}</Text>
              <StarRating rating={avgRating} size={16} />
              <Text style={styles.ratingSummarySub}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</Text>
            </View>
            <View style={styles.ratingBreakdown}>
              {ratingCounts.map(({ star, count }) => (
                <View key={star} style={styles.breakdownRow}>
                  <Text style={styles.breakdownStar}>{star}★</Text>
                  <View style={styles.breakdownBar}>
                    <View style={[styles.breakdownFill, { width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : "0%" }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
          {reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <View style={styles.emptyReviewsIconBox}>
                <Ionicons name="star-outline" size={30} color={GREEN} />
              </View>
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
            </View>
          ) : (
            reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{review.reviewerName?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <View style={styles.reviewInfo}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Listings</Text>
          <View style={styles.tabs}>
            {["active", "sold"].map((tab) => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} activeOpacity={0.7} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === "active" ? `Active (${listings.filter(l => l.status !== "sold").length})` : `Sold / Done (${listings.filter(l => l.status === "sold").length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={GREEN} size="large" />
              <Text style={styles.loadingText}>Loading your listings...</Text>
            </View>
          ) : filteredListings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Text style={styles.emptyIcon}>📭</Text>
              </View>
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptySubtext}>{activeTab === "active" ? "Post something to get started!" : "No sold items yet."}</Text>
              {activeTab === "active" && (
                <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85} onPress={() => navigation.navigate("CreateListing")}>
                  <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyBtnText}>Post a Listing</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredListings.map((item) => {
              const imgUrl = getListingImage(item);
              const typeColor = TYPE_COLORS[item.type] || GREEN;
              const typeLabel = TYPE_LABELS[item.type] || "FOR SALE";
              const isRejected = item.status === "rejected";
              const isPending = item.status === "pending";
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.listingCard, isRejected && styles.listingCardRejected]}
                  onPress={() => isRejected
                    ? navigation.navigate("CreateListing", { editListing: item })
                    : navigation.navigate("ProductDetail", { product: item })}
                  activeOpacity={0.88}
                >
                  <View style={styles.listingImageBox}>
                    {imgUrl ? <Image source={{ uri: imgUrl }} style={styles.listingImage} /> : <Text style={styles.listingImagePlaceholder}>🛍️</Text>}
                    <View style={[styles.listingTypeBadge, { backgroundColor: typeColor }]}>
                      <Text style={styles.listingTypeBadgeText}>{typeLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingName} numberOfLines={2}>{item.name}</Text>
                    {item.type === "donate" ? <Text style={[styles.listingPrice, { color: "#e74c3c" }]}>FREE</Text>
                      : item.type === "barter" ? <Text style={[styles.listingPrice, { color: "#e67e22" }]}>For Barter</Text>
                      : item.type === "buy" ? <Text style={[styles.listingPrice, { color: "#2980b9" }]}>Looking For</Text>
                      : <Text style={styles.listingPrice}>₱{item.price?.toLocaleString()}</Text>}
                    <View style={styles.listingLocationRow}>
                      <Ionicons name="location-sharp" size={11} color="#aaa" />
                      <Text style={styles.listingLocation} numberOfLines={1}>{item.location}</Text>
                    </View>
                    {item.status === "sold" && <View style={styles.soldPill}><Text style={styles.soldPillText}>SOLD</Text></View>}
                    {isPending && (
                      <View style={styles.pendingPill}><Text style={styles.pendingPillText}>⏳ Pending review</Text></View>
                    )}
                    {isRejected && (
                      <>
                        <View style={styles.rejectedPill}><Text style={styles.rejectedPillText}>⚠️ Rejected — tap to edit</Text></View>
                        {item.rejectionReason ? (
                          <Text style={styles.rejectReasonText} numberOfLines={2}>Reason: {item.rejectionReason}</Text>
                        ) : null}
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ paddingRight: 12 }} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );

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
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: GREEN },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileHero: { alignItems: "center", backgroundColor: GREEN, paddingTop: 10, paddingBottom: 36, paddingHorizontal: 20 },
  avatarWrapper: { position: "relative", marginBottom: 14 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#fff" },
  avatarText: { fontSize: 44, fontWeight: "800", color: "#fff" },
  cameraBadge: { position: "absolute", bottom: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: GREEN, elevation: 3 },
  userName: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  userEmail: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 10 },
  facultyBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#C79A2E", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4, marginBottom: 6 },
  facultyText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  facultyPending: { flexDirection: "row", alignItems: "center", backgroundColor: "#B9770E", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4, marginBottom: 6 },
  facultyRejected: { flexDirection: "row", alignItems: "center", backgroundColor: "#C0392B", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4, marginBottom: 6 },
  facultyPendingText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  heroRatingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  followerPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", marginBottom: 10 },
  followerPillText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  heroRatingText: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  verifiedText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  statsCard: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 20, marginTop: -18, borderRadius: 18, borderWidth: 1, borderColor: "#E8EDE5", paddingVertical: 18, elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#999", fontWeight: "500" },
  statDivider: { width: 1, backgroundColor: "#F0F0F0", alignSelf: "stretch", marginVertical: 6 },
  quickActionsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 20, marginTop: 16, marginBottom: 4, gap: 10 },
  quickActionBtn: { flex: 1, minWidth: "18%", flexDirection: "row", justifyContent: "center", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#EAEAEA", paddingVertical: 16, alignItems: "center", gap: 8, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  quickActionIconBox: { position: "relative" },
  quickActionIcon: { fontSize: 20 },
  quickActionLabel: { fontSize: 13, color: "#444", fontWeight: "700" },
  section: { paddingHorizontal: 20, marginBottom: 8, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 14 },
  ratingSummaryCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#EAEAEA", padding: 16, marginBottom: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  ratingSummaryLeft: { alignItems: "center", justifyContent: "center", width: 90, gap: 4 },
  ratingBigNum: { fontSize: 32, fontWeight: "800", color: "#F4C542" },
  ratingSummarySub: { fontSize: 11, color: "#999" },
  ratingBreakdown: { flex: 1, justifyContent: "center", paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: "#F0F0F0" },
  breakdownRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  breakdownStar: { fontSize: 11, color: "#888", width: 22 },
  breakdownBar: { flex: 1, height: 6, backgroundColor: "#F0F0F0", borderRadius: 3, marginHorizontal: 6, overflow: "hidden" },
  breakdownFill: { height: "100%", backgroundColor: "#F4C542", borderRadius: 3 },
  breakdownCount: { fontSize: 10, color: "#999", width: 16, textAlign: "right" },
  emptyReviews: { alignItems: "center", paddingVertical: 30 },
  emptyReviewsIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E8F5EC", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyReviewsText: { fontSize: 13, color: "#999" },
  reviewCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EAEAEA", elevation: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginRight: 10 },
  reviewAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  reviewInfo: { flex: 1 },
  reviewerName: { fontSize: 13, fontWeight: "700", color: "#111", marginBottom: 2 },
  reviewDate: { fontSize: 10, color: "#aaa" },
  reviewComment: { fontSize: 13, color: "#555", lineHeight: 19 },
  tabs: { flexDirection: "row", backgroundColor: "#E8EDE5", borderRadius: 14, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 11 },
  tabActive: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 12, color: "#999", fontWeight: "600" },
  tabTextActive: { color: GREEN, fontWeight: "800" },
  loadingWrap: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: "#999", fontWeight: "500" },
  listingCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#EAEAEA", marginBottom: 12, overflow: "hidden", elevation: 1, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  listingImageBox: { width: 90, height: 90, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", position: "relative" },
  listingImage: { width: 90, height: 90 },
  listingImagePlaceholder: { fontSize: 34 },
  listingTypeBadge: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 3, alignItems: "center" },
  listingTypeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  listingInfo: { flex: 1, padding: 12 },
  listingName: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 5, lineHeight: 19 },
  listingPrice: { fontSize: 15, fontWeight: "800", color: GREEN, marginBottom: 4 },
  listingLocationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  listingLocation: { fontSize: 11, color: "#aaa", flex: 1 },
  soldPill: { marginTop: 4, alignSelf: "flex-start", backgroundColor: "#FDECEA", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  soldPillText: { fontSize: 9, color: "#e74c3c", fontWeight: "800" },
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#444", marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: "#aaa", marginBottom: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13, elevation: 3 },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  listingCardRejected: { borderColor: "#f5c6cb", borderWidth: 1.5, backgroundColor: "#fffafa" },
  pendingPill: { alignSelf: "flex-start", backgroundColor: "#FEF5E7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  pendingPillText: { fontSize: 10.5, fontWeight: "700", color: "#b9770e" },
  rejectedPill: { alignSelf: "flex-start", backgroundColor: "#FDECEA", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  rejectedPillText: { fontSize: 10.5, fontWeight: "700", color: "#c0392b" },
  rejectReasonText: { fontSize: 11, color: "#a94442", marginTop: 3, fontStyle: "italic" },
});
