import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Alert, ActivityIndicator,
  RefreshControl, TextInput, Modal, Image, Platform, KeyboardAvoidingView,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import {
  collection, query, where, getDocs, doc, getDoc, addDoc,
  serverTimestamp, updateDoc, increment, deleteDoc, setDoc,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";
const GOLD = "#F4C542";

const TYPE_COLORS = { sell: GREEN, buy: "#2980b9", barter: "#e67e22", donate: "#e74c3c" };
const TYPE_LABELS = { sell: "FOR SALE", buy: "WANTED", barter: "BARTER", donate: "FREE" };

function StarRating({ rating, size = 20, onPress }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onPress?.(star)} disabled={!onPress} activeOpacity={0.6}>
          <Ionicons name={star <= rating ? "star" : "star-outline"} size={size} color={star <= rating ? GOLD : "#D5D5D5"} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SellerProfileScreen({ route, navigation }) {
  const { sellerId, sellerName } = route.params;
  const [seller, setSeller] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
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
    const storageRef = sRef(storage, path);
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error("Network request failed"));
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
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

  const handleSubmitReview = async () => {
    if (myRating === 0) { Alert.alert("Rating required", "Please select a star rating."); return; }
    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        await updateDoc(doc(db, "reviews", editingReviewId), { rating: myRating, comment: myReview.trim(), editedAt: serverTimestamp() });
        const updated = reviews.map((r) => (r.id === editingReviewId ? { ...r, rating: myRating, comment: myReview.trim() } : r));
        const newAvg = updated.reduce((sum, r) => sum + r.rating, 0) / updated.length;
        await updateDoc(doc(db, "users", sellerId), { avgRating: Math.round(newAvg * 10) / 10 });
        setShowRatingModal(false); setEditingReviewId(null); setMyRating(0); setMyReview("");
        await loadAll();
        Alert.alert("✅ Review Updated!");
        return;
      }
      const existingSnap = await getDocs(query(collection(db, "reviews"), where("sellerId", "==", sellerId), where("reviewerId", "==", currentUser.uid)));
      if (!existingSnap.empty) { Alert.alert("Already Reviewed", "You can edit your existing review instead."); setShowRatingModal(false); return; }
      await addDoc(collection(db, "reviews"), {
        sellerId, sellerName, reviewerId: currentUser.uid,
        reviewerName: currentUser.displayName || "Anonymous",
        rating: myRating, comment: myReview.trim(), createdAt: serverTimestamp(),
      });
      const newAvg = (avgRating * reviews.length + myRating) / (reviews.length + 1);
      await updateDoc(doc(db, "users", sellerId), { avgRating: Math.round(newAvg * 10) / 10, totalReviews: increment(1) });
      setShowRatingModal(false); setMyRating(0); setMyReview("");
      await loadAll();
      Alert.alert("✅ Review Submitted!", "Thank you for your feedback.");
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
          const remaining = reviews.filter((r) => r.id !== review.id);
          const newAvg = remaining.length > 0 ? remaining.reduce((sum, r) => sum + r.rating, 0) / remaining.length : 0;
          await updateDoc(doc(db, "users", sellerId), { avgRating: Math.round(newAvg * 10) / 10, totalReviews: remaining.length });
          await loadAll();
        } catch (e) { Alert.alert("Error", "Failed to delete review."); }
      }},
    ]);
  };

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
  const getListingImage = (item) => item.images?.[0] || item.image || null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]} edges={['left','right']}>
        <ActivityIndicator color={GREEN} size="large" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Home"); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seller Profile</Text>
        {!isOwnProfile ? (
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={openReport}>
            <Ionicons name="flag-outline" size={19} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={{ backgroundColor: LIGHT_BG }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}>
        <View style={styles.hero}>
          {seller?.photoURL ? (
            <Image source={{ uri: seller.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{sellerName?.[0]?.toUpperCase() || "?"}</Text>
            </View>
          )}
          <Text style={styles.sellerName}>{sellerName}</Text>
          <Text style={styles.sellerEmail}>{seller?.email}</Text>

          <View style={styles.heroMetaRow}>
            {seller?.verificationStatus === "verified" && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.verifiedText}>SLSU Verified</Text>
              </View>
            )}
            {seller?.role === "faculty" && (
              <View style={styles.facultyBadge}>
                <Ionicons name="briefcase" size={12} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.verifiedText}>Faculty</Text>
              </View>
            )}
            <View style={styles.followerPill}>
              <Ionicons name="people" size={13} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.followerPillText}>{followerCount} follower{followerCount !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.ratingBlock}>
            <Text style={styles.ratingNumber}>{avgRating > 0 ? avgRating.toFixed(1) : "—"}</Text>
            <StarRating rating={Math.round(avgRating)} size={16} />
            <Text style={styles.ratingCount}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</Text>
          </View>
          <View style={styles.statsDividerVertical} />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{activeListings.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: "#e74c3c" }]}>{soldListings.length}</Text>
              <Text style={styles.statLabel}>Sold</Text>
            </View>
          </View>
        </View>

        {!isOwnProfile && (
          <>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              activeOpacity={0.85}
              onPress={toggleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator color={isFollowing ? GREEN : "#fff"} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? "checkmark" : "add"}
                    size={18}
                    color={isFollowing ? GREEN : "#fff"}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.actionBtns}>
              <TouchableOpacity style={styles.messageBtn} activeOpacity={0.8} onPress={() => handleMessage()}>
                <Ionicons name="chatbubble-ellipses" size={17} color={GREEN} style={{ marginRight: 6 }} />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rateBtn} activeOpacity={0.85} onPress={() => setShowRatingModal(true)}>
                <Ionicons name="star" size={17} color="#5A4A00" style={{ marginRight: 6 }} />
                <Text style={styles.rateBtnText}>Rate Seller</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

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
                <Ionicons name="star-outline" size={32} color={GREEN} />
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
                  <View style={styles.reviewAvatar}>
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
                      <Ionicons name="create-outline" size={14} color={GREEN} />
                      <Text style={styles.reviewActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reviewActionBtn} activeOpacity={0.7} onPress={() => handleDeleteReview(review)}>
                      <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                      <Text style={[styles.reviewActionText, { color: "#e74c3c" }]}>Delete</Text>
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
                <Ionicons name={activeTab === "active" ? "bag-outline" : "checkmark-done"} size={32} color={GREEN} />
              </View>
              <Text style={styles.emptyText}>{activeTab === "active" ? "No active listings" : "No completed listings yet"}</Text>
            </View>
          ) : (
            displayedListings.map((item) => {
              const imgUrl = getListingImage(item);
              return (
                <TouchableOpacity key={item.id} style={styles.listingCard} onPress={() => navigation.navigate("ProductDetail", { product: item })} activeOpacity={0.88}>
                  <View style={styles.listingImageBox}>
                    {imgUrl ? <Image source={{ uri: imgUrl }} style={styles.listingImage} resizeMode="cover" /> : <Text style={styles.listingPlaceholder}>🛍️</Text>}
                    {item.status === "sold" && (
                      <View style={styles.soldOverlay}><Text style={styles.soldOverlayText}>SOLD</Text></View>
                    )}
                  </View>
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.typePill, { backgroundColor: TYPE_COLORS[item.type] || GREEN }]}>
                      <Text style={styles.typePillText}>{TYPE_LABELS[item.type] || "FOR SALE"}</Text>
                    </View>
                    {item.type === "donate" ? <Text style={[styles.listingPrice, { color: "#e74c3c" }]}>FREE</Text>
                      : item.type === "barter" ? <Text style={[styles.listingPrice, { color: "#e67e22" }]}>For Barter</Text>
                      : item.type === "buy" ? <Text style={[styles.listingPrice, { color: "#2980b9" }]}>Looking For</Text>
                      : <Text style={styles.listingPrice}>₱{item.price?.toLocaleString()}</Text>}
                    <View style={styles.listingLocationRow}>
                      <Ionicons name="location-sharp" size={11} color="#aaa" />
                      <Text style={styles.listingLocation}>{item.location}</Text>
                    </View>
                    {item.status === "sold" && !isOwnProfile && (
                      <TouchableOpacity style={styles.askBtn} activeOpacity={0.8} onPress={(e) => { e.stopPropagation?.(); handleMessage(item.name); }}>
                        <Text style={styles.askBtnText}>Ask about this item</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => { setShowRatingModal(false); setEditingReviewId(null); }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowRatingModal(false); setEditingReviewId(null); }}>
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
                <Text style={styles.modalTitle}>{editingReviewId ? "Edit your review" : `Rate ${sellerName}`}</Text>
                <Text style={styles.modalSubtitle}>How was your experience with this seller?</Text>

                <View style={styles.starSelector}>
                  <StarRating rating={myRating} size={40} onPress={setMyRating} />
                </View>
                <Text style={styles.ratingLabel}>
                  {myRating === 1 ? "😞 Poor" : myRating === 2 ? "😕 Fair" : myRating === 3 ? "😐 Good" : myRating === 4 ? "😊 Very Good" : myRating === 5 ? "🤩 Excellent!" : "Tap a star to rate"}
                </Text>

                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Write a review</Text>
                  <Text style={styles.inputOptional}>optional</Text>
                </View>
                <View style={styles.reviewInputWrap}>
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Share your experience with this seller..."
                    placeholderTextColor="#B0B0B0"
                    value={myReview}
                    onChangeText={setMyReview}
                    multiline
                    maxLength={300}
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                  />
                </View>
                <Text style={styles.charCount}>{myReview.length}/300</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => { setShowRatingModal(false); setEditingReviewId(null); }}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.submitBtn, submittingReview && { opacity: 0.7 }]} activeOpacity={0.85} onPress={handleSubmitReview} disabled={submittingReview}>
                    {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{editingReviewId ? "Update Review" : "Submit Review"}</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={closeReport}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={closeReport}>
          <TouchableOpacity style={styles.reportSheet} activeOpacity={1}>
            <View style={styles.reportHandle} />
            <Text style={styles.reportTitle}>Report User</Text>
            <Text style={styles.reportSub}>
              {pendingReason ? "Add details and proof, then submit." : `Why are you reporting ${sellerName}?`}
            </Text>

            {!pendingReason ? (
              <>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity key={reason} style={styles.reasonRow} activeOpacity={0.7} onPress={() => setPendingReason(reason)}>
                    <Ionicons name="flag-outline" size={18} color="#666" style={{ marginRight: 12 }} />
                    <Text style={styles.reasonText}>{reason}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={closeReport}>
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.reasonSelected}>
                  <Ionicons name="flag" size={18} color="#e74c3c" style={{ marginRight: 10 }} />
                  <Text style={styles.reasonSelectedText}>{pendingReason}</Text>
                </View>

                {pendingReason === "Other" && (
                  <>
                    <Text style={styles.fieldLabel}>Describe the issue</Text>
                    <TextInput
                      style={styles.otherInput}
                      placeholder="Tell us what's wrong…"
                      placeholderTextColor="#B0B0B0"
                      value={customReason}
                      onChangeText={setCustomReason}
                      multiline
                      maxLength={200}
                      textAlignVertical="top"
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>Attach proof (optional)</Text>
                {proofImage ? (
                  <View style={styles.proofPreviewWrap}>
                    <Image source={{ uri: proofImage }} style={styles.proofPreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.proofRemove} activeOpacity={0.8} onPress={() => setProofImage(null)}>
                      <Ionicons name="close-circle" size={26} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.proofAddBtn} activeOpacity={0.8} onPress={pickProofImage}>
                    <Ionicons name="camera-outline" size={20} color={GREEN} style={{ marginRight: 8 }} />
                    <Text style={styles.proofAddText}>Add a screenshot or photo</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.reportSubmit, uploadingReport && { opacity: 0.7 }]} activeOpacity={0.85} onPress={submitReport} disabled={uploadingReport}>
                  {uploadingReport ? <ActivityIndicator color="#fff" /> : <Text style={styles.reportSubmitText}>Submit Report</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={() => { setPendingReason(null); setProofImage(null); setCustomReason(""); }} disabled={uploadingReport}>
                  <Text style={styles.reportCancelText}>Go Back</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN, paddingTop: STATUSBAR_TOP },
  loadingText: { marginTop: 14, fontSize: 13, color: "#999", fontWeight: "500" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: GREEN },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  hero: { alignItems: "center", backgroundColor: GREEN, paddingTop: 14, paddingBottom: 36 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  avatarImage: { width: 88, height: 88, borderRadius: 44, marginBottom: 12, borderWidth: 3, borderColor: "#fff" },
  avatarText: { fontSize: 36, fontWeight: "800", color: "#fff" },
  sellerName: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 3 },
  sellerEmail: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 12 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  facultyBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#C79A2E", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  verifiedText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  followerPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  followerPillText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  statsCard: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 20, marginTop: -20, borderRadius: 18, borderWidth: 1, borderColor: "#E8EDE5", padding: 18, elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  ratingBlock: { flex: 1, alignItems: "center" },
  ratingNumber: { fontSize: 32, fontWeight: "900", color: GOLD, marginBottom: 4 },
  ratingCount: { fontSize: 11, color: "#999", marginTop: 6 },
  statsDividerVertical: { width: 1, backgroundColor: "#F0F0F0", marginHorizontal: 16 },
  statsGrid: { flex: 1, flexDirection: "row" },
  statItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: "#222", marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#999" },
  followBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: 20, marginTop: 14, height: 48, borderRadius: 14, backgroundColor: GREEN, elevation: 2, shadowColor: GREEN, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  followingBtn: { backgroundColor: "#fff", borderWidth: 2, borderColor: GREEN, elevation: 0 },
  followBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  followingBtnText: { color: GREEN },
  actionBtns: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 10, marginBottom: 6 },
  messageBtn: { flex: 1, flexDirection: "row", height: 48, borderRadius: 14, borderWidth: 2, borderColor: GREEN, alignItems: "center", justifyContent: "center" },
  messageBtnText: { fontSize: 14, fontWeight: "700", color: GREEN },
  rateBtn: { flex: 1, flexDirection: "row", height: 48, borderRadius: 14, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", elevation: 2 },
  rateBtnText: { fontSize: 14, fontWeight: "700", color: "#5A4A00" },
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EDE5", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tabRow: { flexDirection: "row", marginBottom: 14, backgroundColor: "#E8EDE5", borderRadius: 13, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#fff", elevation: 2 },
  tabText: { fontSize: 12, color: "#999", fontWeight: "600" },
  tabTextActive: { color: GREEN, fontWeight: "800" },
  breakdownRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  breakdownStar: { fontSize: 12, color: GOLD, width: 26, fontWeight: "800" },
  breakdownBar: { flex: 1, height: 7, backgroundColor: "#F0F0F0", borderRadius: 4, marginHorizontal: 10, overflow: "hidden" },
  breakdownFill: { height: "100%", backgroundColor: GOLD, borderRadius: 4 },
  breakdownCount: { fontSize: 11, color: "#999", width: 18, textAlign: "right" },
  reviewCard: { backgroundColor: "#fff", borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: "#E8EDE5", elevation: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginRight: 10 },
  reviewAvatarText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  reviewInfo: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 3 },
  reviewDate: { fontSize: 11, color: "#bbb" },
  reviewComment: { fontSize: 13, color: "#555", lineHeight: 20 },
  reviewActions: { flexDirection: "row", gap: 18, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  reviewActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewActionText: { fontSize: 12, color: GREEN, fontWeight: "700" },
  listingCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E8EDE5", marginBottom: 10, overflow: "hidden", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  listingImageBox: { width: 100, height: 100, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", position: "relative" },
  listingImage: { width: 100, height: 100 },
  listingPlaceholder: { fontSize: 30 },
  soldOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 3, alignItems: "center" },
  soldOverlayText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  listingInfo: { flex: 1, padding: 11, minHeight: 100, justifyContent: "center" },
  listingName: { fontSize: 14, fontWeight: "700", color: "#222", marginBottom: 5 },
  typePill: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 5 },
  typePillText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  listingPrice: { fontSize: 14, fontWeight: "800", color: GREEN, marginBottom: 3 },
  listingLocationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 6 },
  listingLocation: { fontSize: 11, color: "#aaa" },
  askBtn: { backgroundColor: "#E8F5EC", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  askBtnText: { fontSize: 11, color: GREEN, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 36 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8F5EC", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#999", marginBottom: 14 },
  emptyBtn: { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30, maxHeight: "88%" },
  modalHandle: { width: 42, height: 5, backgroundColor: "#E2E2E2", borderRadius: 3, alignSelf: "center", marginBottom: 18 },
  modalTitle: { fontSize: 21, fontWeight: "800", color: "#111", marginBottom: 4, letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13.5, color: "#999", marginBottom: 22 },
  starSelector: { alignItems: "center", marginBottom: 12 },
  ratingLabel: { fontSize: 16, color: "#444", textAlign: "center", marginBottom: 24, fontWeight: "700" },
  inputLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  inputLabel: { fontSize: 14, fontWeight: "700", color: "#222" },
  inputOptional: { fontSize: 12, color: "#AAA", fontWeight: "600" },
  reviewInputWrap: { backgroundColor: "#F7F9F5", borderRadius: 16, borderWidth: 1.5, borderColor: "#E4EBDE", paddingHorizontal: 4, paddingVertical: 2 },
  reviewInput: { fontSize: 15, color: "#222", minHeight: 120, maxHeight: 180, padding: 14, lineHeight: 21 },
  charCount: { fontSize: 11.5, color: "#BBB", textAlign: "right", marginTop: 6, marginBottom: 20 },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: "#E6E6E6", alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 15, color: "#666", fontWeight: "600" },
  submitBtn: { flex: 2, height: 54, borderRadius: 16, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  submitBtnText: { fontSize: 15, color: "#fff", fontWeight: "800" },

  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  reportSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  reportHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#DDD", marginBottom: 16 },
  reportTitle: { fontSize: 19, fontWeight: "800", color: "#111", marginBottom: 4 },
  reportSub: { fontSize: 13.5, color: "#777", marginBottom: 16 },
  reasonRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F2F2F2" },
  reasonText: { flex: 1, fontSize: 15, color: "#222", fontWeight: "500" },
  reasonSelected: { flexDirection: "row", alignItems: "center", backgroundColor: "#FDECEA", borderRadius: 12, padding: 14, marginBottom: 14 },
  reasonSelectedText: { flex: 1, fontSize: 14.5, fontWeight: "700", color: "#c0392b" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 8 },
  otherInput: { backgroundColor: "#F7F9F5", borderRadius: 12, borderWidth: 1.5, borderColor: "#E4EBDE", padding: 12, fontSize: 14, color: "#222", minHeight: 70, marginBottom: 16 },
  proofAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: GREEN, borderStyle: "dashed", marginBottom: 16 },
  proofAddText: { fontSize: 14, color: GREEN, fontWeight: "700" },
  proofPreviewWrap: { position: "relative", marginBottom: 16, alignSelf: "flex-start" },
  proofPreview: { width: 120, height: 120, borderRadius: 12, borderWidth: 1, borderColor: "#EAEAEA" },
  proofRemove: { position: "absolute", top: -8, right: -8, backgroundColor: "#fff", borderRadius: 13 },
  reportSubmit: { height: 52, borderRadius: 14, backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center" },
  reportSubmitText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  reportCancel: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  reportCancelText: { fontSize: 15, fontWeight: "700", color: "#666" },
});
