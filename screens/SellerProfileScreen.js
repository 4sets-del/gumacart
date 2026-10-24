import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator, RefreshControl, Image, } from 'react-native';
import { Alert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, updateDoc, deleteDoc, setDoc,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../firebaseConfig";
import { uploadFile } from "../utils/upload";
import { ProductRow } from "../components/ProductCard";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS, SHADOWS, GRADIENTS, colorForName, FONTS, BRAND_DEEP } from "../constants/theme";
import { academicLabel } from "../constants/school";
import ReportSheet from "../components/ReportSheet";
import Sheet, { FormField, SheetOption } from "../components/Sheet";
import { useBlocked, blockUser, unblockUser } from "../utils/blocking";
import { useTheme } from '../context/ThemeContext';


function StarRating({ rating, size = 20, onPress }) {
  const { COLORS } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`} key={star} onPress={() => onPress?.(star)} disabled={!onPress} activeOpacity={0.6}>
          <Ionicons name={star <= rating ? "star" : "star-outline"} size={size} color={star <= rating ? COLORS.star : "#D5D5D5"} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SellerProfileScreen({ route, navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const { sellerId, sellerName } = route.params;
  const [seller, setSeller] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  // Opened from a "How was your purchase?" notification: show the rating form.
  const openRating = route.params?.openRating === true;
  const [reportVisible, setReportVisible] = useState(false);
  const [pendingReason, setPendingReason] = useState(null);
  const [proofImage, setProofImage] = useState(null);
  const [customReason, setCustomReason] = useState("");
  const [uploadingReport, setUploadingReport] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [activeTab, setActiveTab] = useState("active");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUser = auth.currentUser;
  const isOwnProfile = currentUser?.uid === sellerId;

  useEffect(() => {
    if (openRating && !loading && !isOwnProfile) setShowRatingModal(true);
  }, [openRating, loading, isOwnProfile]);

  const loadAll = async () => {
    try {
      const sellerDoc = await getDoc(doc(db, "users", sellerId));
      if (sellerDoc.exists()) setSeller(sellerDoc.data());
      const listingsSnap = await getDocs(query(collection(db, "listings"), where("sellerId", "==", sellerId)));
      setListings(listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));
      const reviewsSnap = await getDocs(query(collection(db, "reviews"), where("sellerId", "==", sellerId)));
      setReviews(reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));

      const followersSnap = await getDocs(collection(db, "users", sellerId, "followers"));
      setFollowerCount(followersSnap.size);
      if (!isOwnProfile && currentUser?.uid) {
        const myFollowDoc = await getDoc(doc(db, "users", sellerId, "followers", currentUser.uid));
        setIsFollowing(myFollowDoc.exists());
      }
    } catch (e) {
      console.log("Seller profile error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const REPORT_REASONS = ["Scam or fraud", "Harassment", "Fake account", "Inappropriate behavior", "Other"];

  const openReport = () => {
    if (isOwnProfile) return;
    setPendingReason(null);
    setProofImage(null);
    setCustomReason("");
    setReportVisible(true);
  };

  const closeReport = () => {
    setReportVisible(false);
    setPendingReason(null);
    setProofImage(null);
    setCustomReason("");
  };

  const pickProofImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission required", "Allow photo access to attach proof."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.7 });
      if (!result.canceled && result.assets[0]) setProofImage(result.assets[0].uri);
    } catch (e) { Alert.alert("Error", "Could not open gallery."); }
  };

  const uploadProof = async (uri) => {
    const path = `reports/${currentUser.uid}_${Date.now()}.jpg`;
    return uploadFile(uri, path);
  };

  const submitReport = async () => {
    const finalReason = pendingReason === "Other" ? customReason.trim() : pendingReason;
    if (pendingReason === "Other" && finalReason.length < 3) {
      Alert.alert("Please specify", "Type a short reason so admins know the issue.");
      return;
    }
    setUploadingReport(true);
    try {
      let proofImageUrl = null;
      if (proofImage) {
        try { proofImageUrl = await uploadProof(proofImage); }
        catch (e) { /* non-fatal: still submit even if the photo upload fails */ }
      }
      await addDoc(collection(db, "reports"), {
        kind: "user",
        reportedUserId: sellerId,
        reportedUserName: sellerName,
        reason: finalReason,
        proofImageUrl,
        reportedBy: currentUser.uid,
        reporterId: currentUser.uid,
        reporterName: currentUser.displayName || "Anonymous",
        status: "open",
        createdAt: serverTimestamp(),
      });
      closeReport();
      Alert.alert("Report Submitted", "Thank you. Our admins will review this account.");
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setUploadingReport(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser?.uid) return;
    setFollowLoading(true);
    const followerRef = doc(db, "users", sellerId, "followers", currentUser.uid);
    const followingRef = doc(db, "users", currentUser.uid, "following", sellerId);
    try {
      if (isFollowing) {
        await deleteDoc(followerRef);
        await deleteDoc(followingRef);
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await setDoc(followerRef, {
          uid: currentUser.uid,
          name: currentUser.displayName || "Anonymous",
          followedAt: serverTimestamp(),
        });
        await setDoc(followingRef, {
          uid: sellerId,
          name: sellerName,
          followedAt: serverTimestamp(),
        });
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (e) {
      Alert.alert("Error", "Could not update follow status.");
    } finally {
      setFollowLoading(false);
    }
  };

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : seller?.avgRating || 0;

  // The seller's stored avgRating/totalReviews are recalculated by the
  // onReviewWrite Cloud Function; this screen shows the live average from
  // the reviews it loads.
  const handleSubmitReview = async () => {
    if (myRating === 0) { Alert.alert("Rating required", "Please select a star rating."); return; }
    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        await updateDoc(doc(db, "reviews", editingReviewId), { rating: myRating, comment: myReview.trim(), editedAt: serverTimestamp() });
        setShowRatingModal(false); setEditingReviewId(null); setMyRating(0); setMyReview("");
        await loadAll();
        Alert.alert("Review Updated!");
        return;
      }
      const existingSnap = await getDocs(query(collection(db, "reviews"), where("sellerId", "==", sellerId), where("reviewerId", "==", currentUser.uid)));
      if (!existingSnap.empty) { Alert.alert("Already Reviewed", "You can edit your existing review instead."); setShowRatingModal(false); return; }
      await addDoc(collection(db, "reviews"), {
        sellerId, sellerName, reviewerId: currentUser.uid,
        reviewerName: currentUser.displayName || "Anonymous",
        rating: myRating, comment: myReview.trim(), createdAt: serverTimestamp(),
      });
      setShowRatingModal(false); setMyRating(0); setMyReview("");
      await loadAll();
      Alert.alert("Review Submitted!", "Thank you for your feedback.");
    } catch (e) {
      Alert.alert("Error", "Failed to submit review.");
    } finally { setSubmittingReview(false); }
  };

  const handleEditReview = (review) => {
    setEditingReviewId(review.id); setMyRating(review.rating); setMyReview(review.comment || ""); setShowRatingModal(true);
  };

  const handleDeleteReview = (review) => {
    Alert.alert("Delete Review", "Delete this review?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteDoc(doc(db, "reviews", review.id));
          await loadAll();
        } catch (e) { Alert.alert("Error", "Failed to delete review."); }
      }},
    ]);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const blockedByMe = useBlocked().ids.has(sellerId);

  const handleMessage = async (listingName = null) => {
    try {
      const ids = [currentUser.uid, sellerId].sort();
      const conversationId = `${ids[0]}_${ids[1]}`;
      const convoRef = doc(db, "conversations", conversationId);
      const convoDoc = await getDoc(convoRef);
      if (!convoDoc.exists()) {
        await setDoc(convoRef, { participants: [currentUser.uid, sellerId], listingName: listingName || "", lastMessage: "", lastMessageTime: serverTimestamp(), unreadCount: { [currentUser.uid]: 0, [sellerId]: 0 }, createdAt: serverTimestamp() });
      }
      navigation.navigate("Chat", { conversationId, otherUserId: sellerId, otherUserName: sellerName, listingName: listingName || null });
    } catch (e) { Alert.alert("Error", "Could not start conversation."); }
  };

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }));
  const activeListings = listings.filter((l) => l.status !== "sold");
  const soldListings = listings.filter((l) => l.status === "sold");
  const displayedListings = activeTab === "active" ? activeListings : soldListings;

  if (loading) {
    return (
      <View style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {/* Keeps the area behind the status bar green even after the header scrolls away */}
      <View pointerEvents="none" style={[styles.statusBacking, { height: insets.top }]} />

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        <LinearGradient colors={GRADIENTS.primaryDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heroCircle} />
          <View style={styles.heroCircleSmall} />
          <View style={styles.heroTop}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.heroBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Home" }); }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Seller Profile</Text>
            {!isOwnProfile ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="More options" style={styles.heroBtn} activeOpacity={0.7} onPress={() => setMenuOpen(true)}>
                <Ionicons name="ellipsis-vertical" size={19} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
        </LinearGradient>

        <View style={styles.profileCard}>
          <View style={styles.identityRow}>
            {seller?.photoURL ? (
              <Image source={{ uri: seller.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{sellerName?.[0]?.toUpperCase() || "?"}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
              <Text style={styles.sellerEmail} numberOfLines={1}>{seller?.email}</Text>
              <View style={styles.heroMetaRow}>
                {(seller?.course || seller?.yearLevel) && (
                  <View style={[styles.verifiedBadge, { backgroundColor: COLORS.infoLight }]}>
                    <Ionicons name="school" size={12} color={COLORS.info} />
                    <Text style={[styles.verifiedText, { color: COLORS.info }]}>{academicLabel(seller)}</Text>
                  </View>
                )}
                {seller?.verificationStatus === "verified" && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
                    <Text style={styles.verifiedText}>Verified SLSU Student</Text>
                  </View>
                )}
                {seller?.role === "faculty" && (
                  <View style={[styles.verifiedBadge, { backgroundColor: COLORS.accentLight }]}>
                    <Ionicons name="briefcase" size={12} color={COLORS.warning} />
                    <Text style={[styles.verifiedText, { color: COLORS.warning }]}>Faculty</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            {[
              { label: "Rating", value: avgRating > 0 ? avgRating.toFixed(1) : "—", color: "#F59E0B" },
              { label: "Reviews", value: reviews.length, color: "#2563EB" },
              { label: "Listings", value: activeListings.length, color: COLORS.primary },
              { label: "Followers", value: followerCount, color: "#7C3AED" },
            ].map((stat, i) => (
              <View key={stat.label} style={[styles.statItem, i > 0 && styles.statDivider]}>
                <Text style={[styles.statNum, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {!isOwnProfile && (
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                activeOpacity={0.85}
                onPress={toggleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator color={isFollowing ? COLORS.primary : "#fff"} size="small" />
                ) : (
                  <>
                    <Ionicons name={isFollowing ? "checkmark" : "add"} size={18} color={isFollowing ? COLORS.primary : "#fff"} style={{ marginRight: 4 }} />
                    <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                      {isFollowing ? "Following" : "Follow"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageBtn} activeOpacity={0.8} onPress={() => handleMessage()}>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Rate seller" style={styles.rateBtn} activeOpacity={0.85} onPress={() => setShowRatingModal(true)}>
                <Ionicons name="star" size={19} color={COLORS.star} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rating Breakdown</Text>
            <View style={styles.card}>
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
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="star-outline" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyText}>No reviews yet</Text>
              {!isOwnProfile && (
                <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85} onPress={() => setShowRatingModal(true)}>
                  <Text style={styles.emptyBtnText}>Be the first to review</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewAvatar, { backgroundColor: colorForName(review.reviewerName) }]}>
                    <Text style={styles.reviewAvatarText}>{review.reviewerName?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                    <StarRating rating={review.rating} size={13} />
                  </View>
                  <Text style={styles.reviewDate}>{review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : "Recently"}</Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                {review.reviewerId === currentUser?.uid && (
                  <View style={styles.reviewActions}>
                    <TouchableOpacity style={styles.reviewActionBtn} activeOpacity={0.7} onPress={() => handleEditReview(review)}>
                      <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.reviewActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reviewActionBtn} activeOpacity={0.7} onPress={() => handleDeleteReview(review)}>
                      <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                      <Text style={[styles.reviewActionText, { color: COLORS.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Listings</Text>
          <View style={styles.tabRow}>
            {["active", "sold"].map((tab) => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} activeOpacity={0.7} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === "active" ? `Active (${activeListings.length})` : `Sold (${soldListings.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {displayedListings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name={activeTab === "active" ? "bag-outline" : "checkmark-done"} size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyText}>{activeTab === "active" ? "No active listings" : "No completed listings yet"}</Text>
            </View>
          ) : (
            displayedListings.map((item) => (
              <View key={item.id} style={{ marginBottom: 10 }}>
                <ProductRow
                  item={item}
                  onPress={() => navigation.navigate("ProductDetail", { product: item })}
                  right={item.status === "sold" ? (
                    <View style={styles.soldPill}><Text style={styles.soldPillText}>Sold</Text></View>
                  ) : null}
                >
                  {item.status === "sold" && !isOwnProfile && (
                    <TouchableOpacity style={styles.askBtn} activeOpacity={0.8} onPress={() => handleMessage(item.name)}>
                      <Text style={styles.askBtnText}>Ask about this item</Text>
                    </TouchableOpacity>
                  )}
                </ProductRow>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Sheet
        visible={showRatingModal}
        onClose={() => { setShowRatingModal(false); setEditingReviewId(null); }}
        title={editingReviewId ? "Edit your review" : `Rate ${sellerName}`}
        subtitle="How was your experience with this seller?"
        icon="star"
        busy={submittingReview}
        action={{ title: editingReviewId ? "Update Review" : "Submit Review", icon: "send", onPress: handleSubmitReview, loading: submittingReview }}
      >
        <View style={styles.starSelector}>
          <StarRating rating={myRating} size={40} onPress={setMyRating} />
        </View>
        <Text style={styles.ratingLabel}>
          {["Tap a star to rate", "😞 Poor", "😕 Fair", "😐 Good", "😊 Very Good", "🤩 Excellent!"][myRating] || "Tap a star to rate"}
        </Text>
        <FormField
          label="Write a review (optional)"
          icon="chatbox-ellipses-outline"
          placeholder="Share your experience with this seller..."
          value={myReview}
          onChangeText={setMyReview}
          multiline
          maxLength={300}
          hint={`${myReview.length}/300`}
        />
      </Sheet>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={sellerName} icon="person" footer={null}>
        <SheetOption icon="flag" tone="danger" label="Report user" sub="Scam, harassment, fake account…" onPress={() => { setMenuOpen(false); openReport(); }} />
        {blockedByMe ? (
          <SheetOption icon="lock-open" label="Unblock" sub="See their listings and messages again" onPress={() => { setMenuOpen(false); unblockUser(sellerId).catch(() => {}); }} />
        ) : (
          <SheetOption
            icon="ban"
            tone="danger"
            label="Block"
            sub="They can't message you, and you won't see their listings"
            onPress={() => {
              setMenuOpen(false);
              Alert.alert(`Block ${sellerName}?`, "They won't be able to message you, and their listings will be hidden from you. They won't be told. You can unblock them anytime in Settings.", [
                { text: "Cancel", style: "cancel" },
                { text: "Block", style: "destructive", onPress: () => blockUser({ id: sellerId, name: sellerName, photoURL: seller?.photoURL }).catch(() => Alert.alert("Error", "Could not block this person.")) },
              ]);
            }}
          />
        )}
      </Sheet>

      <ReportSheet
        visible={reportVisible}
        onClose={closeReport}
        title="Report User"
        question={`Why are you reporting ${sellerName}?`}
        reasons={REPORT_REASONS}
        reason={pendingReason}
        onReason={(r) => { setPendingReason(r); if (!r) { setProofImage(null); setCustomReason(""); } }}
        details={customReason}
        onDetails={setCustomReason}
        proof={proofImage}
        onPickProof={pickProofImage}
        onRemoveProof={() => setProofImage(null)}
        onSubmit={submitReport}
        submitting={uploadingReport}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  statusBacking: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: BRAND_DEEP },
  safe: { flex: 1, backgroundColor: COLORS.background },
  loadingText: { marginTop: 14, fontSize: 13, color: COLORS.textMuted, fontWeight: "500" },

  hero: { paddingHorizontal: 16, paddingBottom: 60, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroCircle: { position: "absolute", right: -60, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.10)" },
  heroCircleSmall: { position: "absolute", left: -30, bottom: -50, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(245,158,11,0.18)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 18, fontFamily: FONTS.heading, color: "#fff" },

  profileCard: { marginHorizontal: 16, marginTop: -44, backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, ...SHADOWS.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 30, fontFamily: FONTS.heading, color: COLORS.primary },
  sellerName: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  sellerEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 9, paddingVertical: 4 },
  verifiedText: { fontSize: 11, color: COLORS.primary, fontWeight: "700" },

  statsRow: { flexDirection: "row", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  statNum: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  statLabel: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 },

  actionBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  followBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  followingBtn: { backgroundColor: COLORS.primaryPale },
  followBtnText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  followingBtnText: { color: COLORS.primary },
  messageBtn: { flex: 1, flexDirection: "row", height: 46, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  messageBtnText: { fontSize: 14.5, fontWeight: "700", color: COLORS.primary },
  rateBtn: { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.accentLight, alignItems: "center", justifyContent: "center" },

  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionTitle: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 12 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  tabRow: { flexDirection: "row", marginBottom: 14, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  breakdownRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  breakdownStar: { fontSize: 12, color: COLORS.textSecondary, width: 26, fontWeight: "700" },
  breakdownBar: { flex: 1, height: 7, backgroundColor: COLORS.surfaceAlt, borderRadius: 4, marginHorizontal: 10, overflow: "hidden" },
  breakdownFill: { height: "100%", backgroundColor: COLORS.star, borderRadius: 4 },
  breakdownCount: { fontSize: 11, color: COLORS.textMuted, width: 18, textAlign: "right" },
  reviewCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  reviewAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  reviewInfo: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 3 },
  reviewDate: { fontSize: 11, color: COLORS.textMuted },
  reviewComment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  reviewActions: { flexDirection: "row", gap: 18, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  reviewActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewActionText: { fontSize: 12, color: COLORS.primary, fontWeight: "700" },
  soldPill: { alignSelf: "flex-start", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, paddingHorizontal: 9, paddingVertical: 4 },
  soldPillText: { fontSize: 10.5, fontWeight: "700", color: COLORS.textSecondary },
  askBtn: { backgroundColor: COLORS.primaryPale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start", marginTop: 2 },
  askBtnText: { fontSize: 11.5, color: COLORS.primary, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyIconBox: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, marginBottom: 14 },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  starSelector: { alignItems: "center", marginBottom: 12 },
  ratingLabel: { fontSize: 16, color: COLORS.textPrimary, textAlign: "center", marginBottom: 24, fontWeight: "700" },

});
