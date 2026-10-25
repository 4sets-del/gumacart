import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Share, Dimensions, Modal, FlatList, Platform, ActivityIndicator,
} from 'react-native';
import { Alert } from '../components/AppAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  doc, deleteDoc, collection, addDoc, serverTimestamp, updateDoc, increment, query, where, getDocs, orderBy, limit, onSnapshot, getCountFromServer,
} from "firebase/firestore";
import { ref as sRef, deleteObject } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";
import { Image as CachedImage } from "expo-image";
import { uploadFile } from "../utils/upload";
import { RADIUS, FONTS, colorForName } from "../constants/theme";
import { SaveButton, ProductCard } from "../components/ProductCard";
import { useActiveListings } from "../utils/useListings";
import { renewListing, LISTING_LIFETIME_DAYS } from "../utils/renewListing";
import ZoomableImage from "../components/ZoomableImage";
import { useReplyTime } from "../utils/replyTime";
import { ensureConversation } from "../utils/chat";
import { messagingBlockedReason } from "../utils/blocking";
import ShareCard from "../components/ShareCard";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import ReportSheet from "../components/ReportSheet";
import Sheet from "../components/Sheet";
import { useTheme } from '../context/ThemeContext';
import GradientButton from "../components/GradientButton";
import StatusBarScrim from "../components/StatusBarScrim";
import { recordView } from "../utils/views";
import * as Linking from "expo-linking";
import { getUserBasics } from "../utils/userCache";
import { academicLabel } from "../constants/school";
import { markInterested, getInterested } from "../utils/interest";
import { normalizeCategory, priceLabel, typeMeta, listingImage } from "../constants/listings";
import { useSellerRatings } from "../utils/sellerRatings";

const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);

const TYPE_LABELS = { sell: "For Sale", buy: "Looking For", barter: "For Barter", donate: "Free" };

// First line of the product card sent when a buyer taps "Message seller".
const INQUIRY_TEXT = {
  sell: "Hi! Is this still available?",
  donate: "Hi! Is this still available? I'd love to have it.",
  barter: "Hi! I'd like to trade for this. Is it still available?",
  buy: "Hi! I have what you're looking for.",
};

export default function ProductDetailScreen({ route, navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  // Start from the listing passed in, then stay live: price, photos and
  // status update while the page is open, and removal is detected.
  // Opened from a shared link, only the id is known; the rest loads below.
  const initialProduct = route.params?.product || { id: route.params?.id };
  const [product, setProduct] = useState(initialProduct);
  const [removed, setRemoved] = useState(false);
  useEffect(() => onSnapshot(
    doc(db, "listings", initialProduct.id),
    (snap) => {
      if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
      else setRemoved(true);
    },
    () => {},
  ), [initialProduct.id]);
  const [deleting, setDeleting] = useState(false);
  const [marking, setMarking] = useState(false);
  const isSold = product.status === "sold";
  // Listings can have several identical items; each sale takes one.
  const stock = Math.max(1, Number(product.quantity) || 1);
  // Promised to a buyer but not sold yet; still listed, marked "Reserved".
  const isReserved = !isSold && product.reserved === true;
  const reservedForMe = isReserved && product.reservedFor === currentUser?.uid;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [photoZoomed, setPhotoZoomed] = useState(false); // stop swiping photos while zoomed in
  const fullscreenRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [reportVisible, setReportVisible] = useState(false);
  const [pendingReason, setPendingReason] = useState(null);
  const [proofImage, setProofImage] = useState(null);
  const [customReason, setCustomReason] = useState("");
  const [uploadingReport, setUploadingReport] = useState(false);
  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === product.sellerId;
  // Deleted, or no longer visible to buyers (e.g. sent back for review).
  const unavailable = removed || (!isOwner && !["active", "sold", "reserved"].includes(product.status));

  const images = product.images?.length > 0 ? product.images : product.image ? [product.image] : [];
  const galleryRef = useRef(null);
  const sellerRating = useSellerRatings([product])[product.sellerId];

  // Seller stats: how many people messaged about or carted this listing.
  const [interestedCount, setInterestedCount] = useState(null);
  useEffect(() => {
    if (!isOwner || !product.id) return;
    getCountFromServer(collection(db, "listings", product.id, "interested"))
      .then((r) => setInterestedCount(r.data().count))
      .catch(() => {});
  }, [isOwner, product.id]);

  // "Similar items": live listings in the same category, closest in price
  // (same kind of post first), not including this one.
  const { listings: activeListings } = useActiveListings();
  const similar = useMemo(() => {
    const cat = normalizeCategory(product.category);
    if (!cat) return [];
    const price = Number(product.price) || 0;
    return activeListings
      .filter((l) => l.id !== product.id && normalizeCategory(l.category) === cat)
      .sort((a, b) => ((a.type || 'sell') !== (product.type || 'sell')) - ((b.type || 'sell') !== (product.type || 'sell'))
        || Math.abs((Number(a.price) || 0) - price) - Math.abs((Number(b.price) || 0) - price))
      .slice(0, 6);
  }, [activeListings, product.id, product.category, product.price, product.type]);
  const similarRatings = useSellerRatings(similar);
  const openSimilar = useCallback((item) => navigation.push("ProductDetail", { product: item }), [navigation]);


  // Seller's course and year for the seller card (cached per user).
  const [sellerLabel, setSellerLabel] = useState("SLSU Student");
  const sellerReplyTime = useReplyTime(product.sellerId);
  useEffect(() => {
    if (!product.sellerId) return;
    let alive = true;
    getUserBasics(product.sellerId).then((basics) => { if (alive) setSellerLabel(academicLabel(basics)); });
    return () => { alive = false; };
  }, [product.sellerId]);
  const price = priceLabel(product);
  const type = typeMeta(product.type);

  const showImage = (index) => {
    setActiveImageIndex(index);
    galleryRef.current?.scrollToIndex({ index, animated: true });
  };

  useEffect(() => { recordView(product); }, [product.id, product.sellerId]);


  const openFullscreen = (index) => {
    setFullscreenIndex(index);
    setPhotoZoomed(false); setFullscreenVisible(true);
    setTimeout(() => fullscreenRef.current?.scrollToIndex({ index, animated: false }), 100);
  };


  const REPORT_REASONS = ["Spam or misleading", "Inappropriate content", "Scam or fraud", "Prohibited item", "Other"];

  const openReport = () => {
    if (isOwner) return;
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
        catch (e) { /* non-fatal: still submit the report if the photo upload fails */ }
      }
      await addDoc(collection(db, "reports"), {
        kind: "listing",
        listingId: product.id,
        listingName: product.name || product.title || "",
        sellerId: product.sellerId,
        sellerName: product.sellerName || "",
        reason: finalReason,
        proofImageUrl,
        reportedBy: currentUser.uid,
        reporterId: currentUser.uid,
        reporterName: currentUser.displayName || "Anonymous",
        status: "open",
        createdAt: serverTimestamp(),
      });
      closeReport();
      Alert.alert("Report Submitted", "Thank you. Our admins will review this listing.");
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setUploadingReport(false);
    }
  };

  // Shares a link that opens this listing in the app, instead of the
  // seller's phone number.
  const shareLink = async () => {
    try {
      const url = Linking.createURL(`listing/${product.id}`);
      await Share.share({
        message: `Check out "${product.name}" on SLSU-GumaCart (${priceLabel(product).text})\n${url}`,
      });
    } catch (e) {}
  };

  // "Share as image": a designed card (photo, price, GumaCart brand) saved as
  // a picture, for Facebook / Messenger groups. The card is drawn off screen.
  const shareCardRef = useRef(null);
  const [cardPhotoReady, setCardPhotoReady] = useState(false);
  const shareImage = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) { shareLink(); return; }
      // Give the card's photo a moment to load the first time.
      for (let i = 0; i < 20 && !cardPhotoReady && listingImage(product); i++) await new Promise((r) => setTimeout(r, 100));
      const uri = await captureRef(shareCardRef, { format: "png", quality: 0.95 });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: `Share "${product.name}"` });
    } catch (e) {
      Alert.alert("Couldn't make the image", "Sharing the link instead.");
      shareLink();
    }
  };
  const handleShare = () => {
    Alert.alert("Share listing", "Choose how to share it", [
      { text: "Share as image", icon: "image", onPress: shareImage },
      { text: "Share link", icon: "link", onPress: shareLink },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleMessageSeller = async () => {
    const blockedReason = await messagingBlockedReason(product.sellerId, product.sellerName || "this seller");
    if (blockedReason) { Alert.alert("Can't send a message", blockedReason); return; }
    markInterested(product);
    try {
      const conversationId = await ensureConversation(currentUser, product.sellerId);
      const convoRef = doc(db, "conversations", conversationId);
      const msgsRef = collection(db, "conversations", conversationId, "messages");
      // One product card per listing (not repeated if they tap again later).
      const existingSnap = await getDocs(query(msgsRef, where("senderId", "==", currentUser.uid), where("listingId", "==", product.id), limit(1)));
      if (existingSnap.empty) {
        await addDoc(msgsRef, {
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          type: "listing",
          text: INQUIRY_TEXT[product.type] || INQUIRY_TEXT.sell,
          listingId: product.id,
          listingName: product.name || "",
          listingPrice: priceLabel(product).text,
          listingImage: listingImage(product),
          listingType: product.type || "sell",
          createdAt: serverTimestamp(),
        });
        await updateDoc(convoRef, { lastMessage: `🛍️ Interested in "${product.name}"`, lastMessageTime: serverTimestamp(), [`unreadCount.${product.sellerId}`]: increment(1) });
      }
      navigation.navigate("Chat", { conversationId, otherUserId: product.sellerId, otherUserName: product.sellerName, listingName: null });
    } catch (e) { Alert.alert("Error", "Could not start conversation."); }
  };

  // Reserving and marking sold both ask "for/to whom": interested buyers
  // first, then the seller's other recent chats. The server uses the choice
  // to notify that buyer (and everyone else who was interested).
  const [buyerPickerVisible, setBuyerPickerVisible] = useState(false);
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [pickerMode, setPickerMode] = useState("sold"); // "sold" | "reserve"

  const setSoldStatus = async (sold, buyerId = null) => {
    setMarking(true);
    try {
      await updateDoc(doc(db, "listings", product.id), sold
        ? { status: "sold", soldTo: buyerId, soldAt: serverTimestamp(), reserved: false, reservedFor: null }
        : { status: "active", soldTo: null });
      setProduct((p) => ({ ...p, status: sold ? "sold" : "active" })); // instant; the live update confirms it
      if (sold && buyerId) Alert.alert("Marked as sold", "We'll ask the buyer to rate you.");
    } catch (e) {
      Alert.alert("Error", "Failed to update.");
    } finally {
      setMarking(false);
    }
  };

  const openBuyerPicker = async (mode) => {
    setPickerMode(mode);
    const interested = await getInterested(product.id);
    let chatIds = [];
    try {
      const snap = await getDocs(query(
        collection(db, "conversations"),
        where("participants", "array-contains", currentUser.uid),
        orderBy("lastMessageTime", "desc"),
        limit(15),
      ));
      chatIds = snap.docs.map((d) => d.data().participants.find((id) => id !== currentUser.uid)).filter(Boolean);
    } catch (e) {}
    const interestedIds = new Set(interested.map((p) => p.uid));
    const ids = [...interested.map((p) => p.uid), ...chatIds.filter((id) => !interestedIds.has(id))];
    const people = await Promise.all(ids.map(async (uid) => ({
      uid,
      interested: interestedIds.has(uid),
      ...(await getUserBasics(uid)),
    })));
    setBuyerOptions(people);
    setBuyerPickerVisible(true);
  };

  const setReservation = async (reserved, buyerId = null) => {
    const changes = reserved
      ? { reserved: true, reservedFor: buyerId, reservedAt: serverTimestamp(), reserveReminderSent: false }
      : { reserved: false, reservedFor: null, reservedAt: null };
    setProduct((p) => ({ ...p, reserved, reservedFor: reserved ? buyerId : null }));
    try {
      await updateDoc(doc(db, "listings", product.id), changes);
    } catch (e) {
      setProduct((p) => ({ ...p, reserved: !reserved }));
      Alert.alert("Error", "Could not update the listing.");
    }
  };

  const toggleReserved = () => {
    if (isReserved) {
      Alert.alert("Release reservation?", "The item becomes available again and interested buyers are notified.", [
        { text: "Cancel", style: "cancel" },
        { text: "Release", onPress: () => setReservation(false) },
      ]);
    } else {
      openBuyerPicker("reserve");
    }
  };

  const handleMarkSold = async () => {
    if (isSold) {
      Alert.alert("Mark as Active?", "Move listing back to active.", [
        { text: "Cancel", style: "cancel" },
        { text: "Mark Active", onPress: () => setSoldStatus(false) },
      ]);
    } else {
      openBuyerPicker("sold");
    }
  };

  // Sell one unit of a multi-quantity listing; the last one marks it sold.
  const sellOne = async (buyerId) => {
    if (stock <= 1) return setSoldStatus(true, buyerId);
    setMarking(true);
    try {
      await updateDoc(doc(db, "listings", product.id), {
        quantity: stock - 1,
        lastSaleTo: buyerId,
        lastSaleAt: serverTimestamp(),
      });
      setProduct((p) => ({ ...p, quantity: stock - 1 }));
      Alert.alert("Sold one", `${stock - 1} left.${buyerId ? " We'll ask the buyer to rate you." : ""}`);
    } catch (e) {
      Alert.alert("Error", "Failed to update.");
    } finally {
      setMarking(false);
    }
  };

  const chooseBuyer = (buyerId) => {
    setBuyerPickerVisible(false);
    if (pickerMode === "reserve") setReservation(true, buyerId);
    else sellOne(buyerId);
  };

  const handleDelete = async () => {
    Alert.alert("Delete Listing", "Permanently delete this listing?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setDeleting(true);
        try {
          const allUrls = [...new Set([...(product.images || []), ...(product.image ? [product.image] : [])])];
          if (allUrls.length > 0) {
            await Promise.all(allUrls.map(async (url) => { try { await deleteObject(sRef(storage, url)); } catch (e) {} }));
          }
          await deleteDoc(doc(db, "listings", product.id));
          Alert.alert("Deleted", "Listing removed.", [{ text: "OK", onPress: () => navigation.goBack() }]);
        } catch (e) { Alert.alert("Error", "Failed to delete."); }
        finally { setDeleting(false); }
      }},
    ]);
  };

  if (!product.sellerId && !removed) {
    return (
      <View style={[styles.safe, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      {/* Off-screen card captured by "Share as image". */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareCardRef} item={product} sellerLabel={sellerLabel} onImageLoad={() => setCardPhotoReady(true)} />
      </View>
      <StatusBarScrim />

      <View style={[styles.header, { paddingTop: STATUSBAR_TOP + 8 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Home" }); }}>
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {!isOwner && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Report listing" style={styles.headerBtn} activeOpacity={0.7} onPress={openReport}>
              <Ionicons name="flag-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share listing" style={styles.headerBtn} activeOpacity={0.7} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          {images.length > 0 ? (
            <FlatList
              ref={galleryRef}
              data={images}
              keyExtractor={(_, i) => String(i)}
              horizontal pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              onMomentumScrollEnd={(e) => setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.95} onPress={() => openFullscreen(index)}>
                  <CachedImage source={{ uri: item }} style={styles.galleryImage} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 72 }}>🛍️</Text>
              <Text style={{ color: COLORS.textMuted, marginTop: 8, fontSize: 13 }}>No photo available</Text>
            </View>
          )}

          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => <View key={i} style={[styles.dot, activeImageIndex === i && styles.dotActive]} />)}
            </View>
          )}
          {isSold && (
            <View style={styles.soldBanner} pointerEvents="none">
              <View style={styles.soldBannerPill}>
                <Text style={styles.soldBannerText}>SOLD</Text>
              </View>
            </View>
          )}
        </View>

        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {images.map((uri, i) => (
              <TouchableOpacity key={uri + i} activeOpacity={0.8} onPress={() => showImage(i)}>
                <CachedImage source={{ uri }} style={[styles.thumb, activeImageIndex === i && styles.thumbActive]} contentFit="cover" cachePolicy="memory-disk" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.content}>
          {/* Seller-only stats: how much attention this listing gets. */}
          {isOwner && product.status !== "pending" && product.status !== "rejected" ? (
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
              {[
                ["eye", "Views", product.viewCount || 0, "#2563EB"],
                ["heart", "Saves", Math.max(0, product.saveCount || 0), COLORS.error],
                ["chatbubbles", "Interested", interestedCount ?? "–", "#7C3AED"],
              ].map(([icon, label, value, color]) => (
                <View key={label} style={styles.statTile}>
                  <Ionicons name={icon} size={16} color={color} />
                  <Text style={styles.statNum}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
              </View>
              <Text style={styles.statsNote}>Only you can see these numbers.</Text>
            </View>
          ) : null}

          {isOwner && product.status === "expired" ? (
            <View style={styles.expiredBox}>
              <Ionicons name="hourglass" size={18} color={COLORS.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expiredTitle}>This listing expired</Text>
                <Text style={styles.expiredText}>Listings are hidden after {LISTING_LIFETIME_DAYS} days. Still available? Renew it to put it back on top.</Text>
              </View>
              <TouchableOpacity
                style={styles.renewBtn}
                activeOpacity={0.85}
                onPress={() => renewListing(product.id)
                  .then(() => Alert.alert("Renewed", "Your listing is live again."))
                  .catch(() => Alert.alert("Error", "Could not renew the listing."))}
              >
                <Text style={styles.renewText}>Renew</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {unavailable && (
            <View style={styles.unavailableBox}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.unavailableText}>
                {removed ? "This listing was removed by the seller." : product.status === "expired" ? "This listing has expired." : "This listing isn't available right now."}
              </Text>
            </View>
          )}
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={[styles.price, { color: price.color }]}>{price.text}</Text>

          {sellerRating?.avg > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={COLORS.star} />
              <Text style={styles.ratingText}>
                {sellerRating.avg.toFixed(1)}
                <Text style={styles.ratingSub}>  ({sellerRating.count} seller review{sellerRating.count !== 1 ? "s" : ""})</Text>
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons
                name={isSold ? "close-circle-outline" : isReserved ? "bookmark-outline" : "checkmark-circle-outline"}
                size={16}
                color={isSold ? COLORS.error : isReserved ? COLORS.warning : COLORS.primary}
              />
              <Text style={styles.metaText}>{isSold ? "Sold" : reservedForMe ? "Reserved for you" : isReserved ? "Reserved for a buyer" : stock > 1 ? `${stock} available` : "Available"}</Text>
            </View>
            {product.location ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>{product.location}</Text>
              </View>
            ) : null}
            {product.viewCount > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="eye-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{product.viewCount} view{product.viewCount !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>

          <View style={styles.pillsRow}>
            <View style={[styles.pill, { backgroundColor: type.bg }]}><Text style={[styles.pillText, { color: type.color }]}>{TYPE_LABELS[product.type] || "For Sale"}</Text></View>
            {product.category ? <View style={styles.pill}><Text style={styles.pillText}>{normalizeCategory(product.category)}</Text></View> : null}
            {product.condition ? <View style={styles.pill}><Text style={styles.pillText}>{product.condition}</Text></View> : null}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description || "No description provided."}</Text>

          {/* Older listings may have a separate Specifications field (no
              longer asked for when posting). */}
          {product.specifications ? (
            <>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <Text style={styles.description}>{product.specifications}</Text>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.card}>
            <DetailRow icon="cube-outline" label="Condition" value={product.condition || "Not specified"} />
            <DetailRow icon="pricetag-outline" label="Category" value={normalizeCategory(product.category) || "Not specified"} />
            <DetailRow icon="location-outline" label="Meet-up" value={product.location || "Not specified"} last />
          </View>

          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() => navigation.navigate("SellerProfile", { sellerId: product.sellerId, sellerName: product.sellerName })}
            activeOpacity={0.85}
          >
            <View style={styles.sellerLeft}>
              {product.sellerPhoto ? (
                <CachedImage source={{ uri: product.sellerPhoto }} style={styles.sellerAvatar} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.sellerAvatar, { backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 20, fontFamily: FONTS.heading, color: "#fff" }}>{product.sellerName?.[0]?.toUpperCase() || "?"}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName} numberOfLines={1}>{product.sellerName || "Anonymous"}</Text>
                <Text style={styles.sellerSub} numberOfLines={1}>{sellerLabel}</Text>
                {sellerReplyTime ? <Text style={styles.sellerReply} numberOfLines={1}>⚡ {sellerReplyTime}</Text> : null}
              </View>
            </View>
            <View style={styles.viewProfileBtn}>
              <Text style={styles.viewProfileText}>View Profile</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          {similar.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Similar items</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map((item) => (
                  <ProductCard key={item.id} item={item} rating={similarRatings[item.sellerId]} width={150} onPress={openSimilar} />
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <Modal statusBarTranslucent visible={fullscreenVisible} transparent animationType="fade" onRequestClose={() => setFullscreenVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close photo viewer" style={styles.fullscreenClose} activeOpacity={0.7} onPress={() => setFullscreenVisible(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.fullscreenCounter}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{fullscreenIndex + 1} / {images.length}</Text>
          </View>
          <FlatList
            ref={fullscreenRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal pagingEnabled scrollEnabled={!photoZoomed}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            initialScrollIndex={fullscreenIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            onMomentumScrollEnd={(e) => setFullscreenIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                <ZoomableImage uri={item} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} onZoomChange={setPhotoZoomed} />
              </View>
            )}
          />
          {images.length > 1 && (
            <View style={styles.fullscreenDots}>
              {images.map((_, i) => <View key={i} style={[styles.dot, fullscreenIndex === i && styles.dotActive]} />)}
            </View>
          )}
        </View>
      </Modal>

      {unavailable && !isOwner ? null : isOwner ? (
        <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.85} onPress={() => navigation.navigate("CreateListing", { editListing: product })} disabled={marking || deleting}>
            <Ionicons name="create-outline" size={19} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          {!isSold && stock === 1 && (
            <TouchableOpacity
              style={[styles.reserveBtn, isReserved && styles.reserveBtnOn]}
              activeOpacity={0.85}
              onPress={toggleReserved}
              disabled={marking || deleting}
              accessibilityRole="button"
              accessibilityLabel={isReserved ? "Unreserve listing" : "Mark as reserved"}
            >
              <Ionicons name={isReserved ? "bookmark" : "bookmark-outline"} size={19} color={isReserved ? "#fff" : COLORS.warning} />
              <Text style={[styles.reserveBtnText, isReserved && { color: "#fff" }]}>{isReserved ? "Reserved" : "Reserve"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.primaryBtn, isSold && styles.markActiveBtn, (marking || deleting) && { opacity: 0.6 }]} activeOpacity={0.85} onPress={handleMarkSold} disabled={marking || deleting}>
            <Text style={styles.primaryBtnText}>{marking ? "Updating..." : isSold ? "Mark as Active" : stock > 1 ? `Sold one (${stock} left)` : "Mark as Sold"}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete listing" style={[styles.deleteIconBtn, deleting && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleDelete} disabled={deleting || marking}>
            <Ionicons name="trash-outline" size={21} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
          <SaveButton item={product} size={22} plain style={styles.chatBtn} />
          {isSold ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleMessageSeller}>
              <Text style={styles.primaryBtnText}>Ask if Still Available</Text>
            </TouchableOpacity>
          ) : reservedForMe ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleMessageSeller}>
              <Ionicons name="bookmark" size={17} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Reserved for you · Message seller</Text>
            </TouchableOpacity>
          ) : isReserved ? (
            <TouchableOpacity style={[styles.primaryBtn, styles.reservedBuyerBtn]} activeOpacity={0.85} onPress={handleMessageSeller}>
              <Ionicons name="bookmark" size={17} color={COLORS.warning} style={{ marginRight: 8 }} />
              <Text style={[styles.primaryBtnText, { color: COLORS.warning }]}>Reserved · Ask to be next</Text>
            </TouchableOpacity>
          ) : (
            <GradientButton title="Message Seller" icon="chatbubble-ellipses-outline" onPress={handleMessageSeller} style={{ flex: 1 }} />
          )}
        </View>
      )}

      {/* Mark as sold → who bought it? */}
      <Sheet
        visible={buyerPickerVisible}
        onClose={() => setBuyerPickerVisible(false)}
        title={pickerMode === "reserve" ? "Reserve for whom?" : "Who bought it?"}
        subtitle={pickerMode === "reserve"
          ? "They'll see it's reserved for them. Others who were interested are told it's reserved."
          : "We'll invite them to rate you, and let others who were interested know it's sold."}
        icon={pickerMode === "reserve" ? "bookmark" : "bag-check"}
        footer={
          <View style={styles.pickerFooter}>
            <TouchableOpacity style={styles.pickerSkip} activeOpacity={0.8} onPress={() => chooseBuyer(null)}>
              <Text style={styles.pickerSkipText}>
                {pickerMode === "reserve" ? "Someone not on this list" : "Skip, sold to someone else"}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.pickerList}>
          {buyerOptions.map((person) => (
            <TouchableOpacity key={person.uid} style={styles.pickerRow} activeOpacity={0.75} onPress={() => chooseBuyer(person.uid)}>
              {person.photoURL ? (
                <CachedImage source={{ uri: person.photoURL }} style={styles.pickerAvatar} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.pickerAvatar, { backgroundColor: colorForName(person.name) }]}>
                  <Text style={styles.pickerInitial}>{person.name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
              )}
              <Text style={styles.pickerName} numberOfLines={1}>{person.name}</Text>
              {person.interested && <Text style={styles.interestedTag}>Interested</Text>}
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          {buyerOptions.length === 0 && (
            <View style={styles.pickerEmpty}>
              <Ionicons name="chatbubbles-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.pickerEmptyText}>No recent chats found.</Text>
            </View>
          )}
        </View>
      </Sheet>

      <ReportSheet
        visible={reportVisible}
        onClose={closeReport}
        title="Report Listing"
        question={"Why are you reporting this listing?"}
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
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, last }) {
  const { COLORS, styles } = useTheme(createStyles);
  return (
    <View style={[styles.detailRow, !last && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
      <View style={styles.detailIconBox}><Ionicons name={icon} size={16} color={COLORS.primary} /></View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center" },
  offscreen: { position: "absolute", left: -10000, top: 0 },
  imageContainer: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: COLORS.surfaceAlt },
  galleryImage: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  dotsRow: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { backgroundColor: COLORS.surface, width: 18 },
  soldBanner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  soldBannerPill: { backgroundColor: COLORS.error, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12 },
  soldBannerText: { fontSize: 26, fontFamily: FONTS.heading, color: "#fff", letterSpacing: 4 },
  thumbRow: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  thumb: { width: 62, height: 62, borderRadius: RADIUS.md, borderWidth: 2, borderColor: "transparent" },
  thumbActive: { borderColor: COLORS.primary },
  fullscreenClose: { position: "absolute", top: 52, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  fullscreenCounter: { position: "absolute", top: 58, left: 0, right: 0, zIndex: 10, alignItems: "center" },
  fullscreenDots: { position: "absolute", bottom: 48, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },

  content: { paddingHorizontal: 18, paddingTop: 16 },
  productName: { fontSize: 21, fontWeight: "700", color: COLORS.textPrimary, lineHeight: 28 },
  price: { fontSize: 24, fontFamily: FONTS.heading, marginTop: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  ratingText: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  ratingSub: { fontWeight: "500", color: COLORS.textMuted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  metaText: { fontSize: 13, color: COLORS.textSecondary },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  pill: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  divider: { height: 1, backgroundColor: COLORS.border, marginTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginTop: 18, marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  detailRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  detailIconBox: { width: 28, alignItems: "center" },
  detailLabel: { fontSize: 13, color: COLORS.textMuted, width: 80 },
  detailValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600", flex: 1 },
  sellerCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginTop: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sellerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0, marginRight: 10 },
  sellerAvatar: { width: 46, height: 46, borderRadius: 23 },
  sellerName: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 2 },
  // The tiles get their own (non-wrapping) row: with flexWrap, Android
  // squeezed flex:1 tiles to zero width.
  statsCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingTop: 12, marginBottom: 14 },
  statsRow: { flexDirection: "row" },
  statTile: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  statLabel: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
  statsNote: { textAlign: "center", fontSize: 11, color: COLORS.textMuted, paddingVertical: 8 },
  similarRow: { gap: 10, paddingVertical: 4, paddingRight: 4 },
  sellerReply: { fontSize: 11.5, fontWeight: "700", color: COLORS.primary, marginTop: 2 },
  sellerSub: { fontSize: 12, color: COLORS.primary, fontWeight: "500" },
  viewProfileBtn: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 7 },
  viewProfileText: { fontSize: 12, color: COLORS.primary, fontWeight: "700" },

  expiredBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 12 },
  expiredTitle: { fontSize: 14, fontWeight: "800", color: COLORS.warning },
  expiredText: { fontSize: 12.5, lineHeight: 17, color: COLORS.textSecondary, marginTop: 2 },
  renewBtn: { backgroundColor: COLORS.warning, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  renewText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  unavailableBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 12 },
  unavailableText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: COLORS.error },
  pickerList: { marginTop: 10, gap: 8 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  pickerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  pickerInitial: { color: "#fff", fontSize: 16, fontFamily: FONTS.heading },
  pickerName: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  pickerEmpty: { alignItems: "center", gap: 6, paddingVertical: 24 },
  pickerEmptyText: { fontSize: 13.5, color: COLORS.textMuted },
  pickerFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  pickerSkip: { height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center" },
  pickerSkipText: { fontSize: 14.5, fontWeight: "700", color: COLORS.textSecondary },
  interestedTag: { fontSize: 11, fontWeight: "700", color: COLORS.primary, backgroundColor: COLORS.primaryPale, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, overflow: "hidden" },
  reserveBtn: { width: 64, height: 52, gap: 1, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.warning, alignItems: "center", justifyContent: "center" },
  reserveBtnOn: { backgroundColor: COLORS.warning },
  reserveBtnText: { fontSize: 10.5, fontWeight: "700", color: COLORS.warning },
  reservedBuyerBtn: { backgroundColor: COLORS.warningLight },
  bottomBar: { flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingTop: 12, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  chatBtn: { width: 52, height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  primaryBtn: { flex: 1, flexDirection: "row", height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 15.5, fontWeight: "700", color: "#fff" },
  editBtn: { width: 58, height: 52, gap: 1, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  editBtnText: { fontSize: 10.5, fontWeight: "700", color: COLORS.primary },
  markActiveBtn: { backgroundColor: COLORS.info },
  deleteIconBtn: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.errorLight, alignItems: "center", justifyContent: "center" },

});
