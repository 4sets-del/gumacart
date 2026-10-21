import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Image, Alert, Share, Dimensions, Modal, FlatList, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  doc, deleteDoc, getDoc, setDoc, collection, addDoc, serverTimestamp, updateDoc, increment, query, where, getDocs,
} from "firebase/firestore";
import { ref as sRef, deleteObject } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";
import { Image as CachedImage } from "expo-image";
import { uploadFile } from "../utils/upload";
import { COLORS, RADIUS, FONTS } from "../constants/theme";
import GradientButton from "../components/GradientButton";
import StatusBarScrim from "../components/StatusBarScrim";
import { recordView } from "../utils/views";
import { normalizeCategory, priceLabel, typeMeta } from "../constants/listings";
import { useSellerRatings } from "../utils/sellerRatings";
import { addToCart, removeFromCart } from "../utils/cart";

const GREEN = COLORS.primary;
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);

const TYPE_LABELS = { sell: "For Sale", buy: "Looking For", barter: "For Barter", donate: "Free" };

export default function ProductDetailScreen({ route, navigation }) {
  const { product } = route.params;
  const [inCart, setInCart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [marking, setMarking] = useState(false);
  const [isSold, setIsSold] = useState(product.status === "sold");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const fullscreenRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [reportVisible, setReportVisible] = useState(false);
  const [pendingReason, setPendingReason] = useState(null);
  const [proofImage, setProofImage] = useState(null);
  const [customReason, setCustomReason] = useState("");
  const [uploadingReport, setUploadingReport] = useState(false);
  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === product.sellerId;

  const images = product.images?.length > 0 ? product.images : product.image ? [product.image] : [];
  const galleryRef = useRef(null);
  const sellerRating = useSellerRatings([product])[product.sellerId];
  const price = priceLabel(product);
  const type = typeMeta(product.type);

  const showImage = (index) => {
    setActiveImageIndex(index);
    galleryRef.current?.scrollToIndex({ index, animated: true });
  };

  useEffect(() => { recordView(product); }, [product.id]);

  useEffect(() => {
    const checkCart = async () => {
      try {
        const cartDoc = await getDoc(doc(db, "users", currentUser.uid, "cart", product.id));
        setInCart(cartDoc.exists());
      } catch (e) {}
    };
    checkCart();
  }, []);

  const toggleCart = async () => {
    try {
      if (inCart) { await removeFromCart(currentUser.uid, product.id); setInCart(false); }
      else {
        await addToCart(currentUser.uid, product);
        setInCart(true);
        Alert.alert("🛒 Added to Cart", `"${product.name}" has been saved to your cart.`);
      }
    } catch (e) { Alert.alert("Error", "Could not update cart."); }
  };

  const openFullscreen = (index) => {
    setFullscreenIndex(index);
    setFullscreenVisible(true);
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

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out this listing on SLSU-GumaCart!\n\n${product.name}\n${product.type === "donate" ? "FREE" : product.type === "barter" ? "For Barter" : "₱" + product.price?.toLocaleString()}\nContact: ${product.contactNumber}` });
    } catch (e) {}
  };

  const handleMessageSeller = async () => {
    try {
      const ids = [currentUser.uid, product.sellerId].sort();
      const conversationId = `${ids[0]}_${ids[1]}`;
      const convoRef = doc(db, "conversations", conversationId);
      const convoDoc = await getDoc(convoRef);
      if (!convoDoc.exists()) {
        await setDoc(convoRef, { participants: [currentUser.uid, product.sellerId], lastMessage: "", lastMessageTime: serverTimestamp(), unreadCount: { [currentUser.uid]: 0, [product.sellerId]: 0 }, createdAt: serverTimestamp() });
      }
      const msgsRef = collection(db, "conversations", conversationId, "messages");
      const inquiryText = `🛍️ Hi! I'm interested in your listing: "${product.name}"`;
      const existingSnap = await getDocs(query(msgsRef, where("senderId", "==", currentUser.uid), where("text", "==", inquiryText)));
      if (existingSnap.empty) {
        await addDoc(msgsRef, { senderId: currentUser.uid, senderName: currentUser.displayName, text: inquiryText, type: "text", createdAt: serverTimestamp() });
        if (product.image) await addDoc(msgsRef, { senderId: currentUser.uid, senderName: currentUser.displayName, text: "", type: "image", mediaUrl: product.image, createdAt: serverTimestamp() });
        await updateDoc(convoRef, { lastMessage: inquiryText, lastMessageTime: serverTimestamp(), [`unreadCount.${product.sellerId}`]: increment(1) });
      }
      navigation.navigate("Chat", { conversationId, otherUserId: product.sellerId, otherUserName: product.sellerName, listingName: null });
    } catch (e) { Alert.alert("Error", "Could not start conversation."); }
  };

  const handleMarkSold = async () => {
    const newStatus = isSold ? "active" : "sold";
    Alert.alert(isSold ? "Mark as Active?" : "Mark as Sold?", isSold ? "Move listing back to active." : "Archive this listing.", [
      { text: "Cancel", style: "cancel" },
      { text: isSold ? "Mark Active" : "Mark as Sold", onPress: async () => {
        setMarking(true);
        try { await updateDoc(doc(db, "listings", product.id), { status: newStatus }); setIsSold(!isSold); }
        catch (e) { Alert.alert("Error", "Failed to update."); }
        finally { setMarking(false); }
      }},
    ]);
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
          Alert.alert("✅ Deleted", "Listing removed.", [{ text: "OK", onPress: () => navigation.goBack() }]);
        } catch (e) { Alert.alert("Error", "Failed to delete."); }
        finally { setDeleting(false); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
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
              <Ionicons name={isSold ? "close-circle-outline" : "checkmark-circle-outline"} size={16} color={isSold ? COLORS.error : COLORS.primary} />
              <Text style={styles.metaText}>{isSold ? "Sold" : "Available"}</Text>
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
            <DetailRow icon="location-outline" label="Meet-up" value={product.location || "Not specified"} />
            <DetailRow icon="call-outline" label="Contact" value={product.contactNumber || "Not provided"} last />
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
                <View style={[styles.sellerAvatar, { backgroundColor: GREEN, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 20, fontFamily: FONTS.heading, color: "#fff" }}>{product.sellerName?.[0]?.toUpperCase() || "?"}</Text>
                </View>
              )}
              <View>
                <Text style={styles.sellerName}>{product.sellerName || "Anonymous"}</Text>
                <Text style={styles.sellerSub}>SLSU Student</Text>
              </View>
            </View>
            <View style={styles.viewProfileBtn}>
              <Text style={styles.viewProfileText}>View Profile</Text>
              <Ionicons name="chevron-forward" size={13} color={GREEN} />
            </View>
          </TouchableOpacity>

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
            horizontal pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            initialScrollIndex={fullscreenIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            onMomentumScrollEnd={(e) => setFullscreenIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                <CachedImage source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} contentFit="contain" cachePolicy="memory-disk" />
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

      {isOwner ? (
        <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.85} onPress={() => navigation.navigate("CreateListing", { editListing: product })} disabled={marking || deleting}>
            <Ionicons name="create-outline" size={19} color={GREEN} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, isSold && styles.markActiveBtn, (marking || deleting) && { opacity: 0.6 }]} activeOpacity={0.85} onPress={handleMarkSold} disabled={marking || deleting}>
            <Text style={styles.primaryBtnText}>{marking ? "Updating..." : isSold ? "Mark as Active" : "Mark as Sold"}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete listing" style={[styles.deleteIconBtn, deleting && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleDelete} disabled={deleting || marking}>
            <Ionicons name="trash-outline" size={21} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Message seller" style={styles.chatBtn} activeOpacity={0.8} onPress={handleMessageSeller}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={GREEN} />
          </TouchableOpacity>
          {isSold ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleMessageSeller}>
              <Text style={styles.primaryBtnText}>Ask if Still Available</Text>
            </TouchableOpacity>
          ) : (
            inCart ? (
              <TouchableOpacity style={[styles.primaryBtn, styles.inCartBtn]} activeOpacity={0.85} onPress={toggleCart}>
                <Ionicons name="checkmark" size={19} color={GREEN} style={{ marginRight: 8 }} />
                <Text style={[styles.primaryBtnText, { color: GREEN }]}>In Cart</Text>
              </TouchableOpacity>
            ) : (
              <GradientButton title="Add to Cart" icon="cart-outline" onPress={toggleCart} style={{ flex: 1 }} />
            )
          )}
        </View>
      )}

      <Modal statusBarTranslucent visible={reportVisible} transparent animationType="fade" onRequestClose={closeReport}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={closeReport}>
          <TouchableOpacity style={styles.reportSheet} activeOpacity={1}>
            <View style={styles.reportHandle} />
            <Text style={styles.reportTitle}>Report Listing</Text>
            <Text style={styles.reportSub}>
              {pendingReason ? "Add details and proof, then submit." : "Why are you reporting this listing?"}
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
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove proof photo" style={styles.proofRemove} activeOpacity={0.8} onPress={() => setProofImage(null)}>
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

function DetailRow({ icon, label, value, last }) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" }]}>
      <View style={styles.detailIconBox}><Ionicons name={icon} size={16} color={GREEN} /></View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center" },
  imageContainer: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: COLORS.surfaceAlt },
  galleryImage: { width: SCREEN_WIDTH, height: IMAGE_HEIGHT },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  dotsRow: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { backgroundColor: "#fff", width: 18 },
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
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  detailRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  detailIconBox: { width: 28, alignItems: "center" },
  detailLabel: { fontSize: 13, color: COLORS.textMuted, width: 80 },
  detailValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600", flex: 1 },
  sellerCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginTop: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sellerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  sellerAvatar: { width: 46, height: 46, borderRadius: 23 },
  sellerName: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 2 },
  sellerSub: { fontSize: 12, color: COLORS.primary, fontWeight: "500" },
  viewProfileBtn: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 7 },
  viewProfileText: { fontSize: 12, color: GREEN, fontWeight: "700" },

  bottomBar: { flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingTop: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  chatBtn: { width: 52, height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: GREEN, alignItems: "center", justifyContent: "center" },
  primaryBtn: { flex: 1, flexDirection: "row", height: 52, borderRadius: RADIUS.md, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 15.5, fontWeight: "700", color: "#fff" },
  inCartBtn: { backgroundColor: COLORS.primaryPale },
  editBtn: { flexDirection: "row", gap: 5, paddingHorizontal: 16, height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: GREEN, alignItems: "center", justifyContent: "center" },
  editBtnText: { fontSize: 14, fontWeight: "700", color: GREEN },
  markActiveBtn: { backgroundColor: COLORS.info },
  deleteIconBtn: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.errorLight, alignItems: "center", justifyContent: "center" },

  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  reportSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  reportHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#DDD", marginBottom: 16 },
  reportTitle: { fontSize: 19, fontFamily: FONTS.heading, color: "#111", marginBottom: 4 },
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
  reportSubmitText: { fontSize: 15, fontFamily: FONTS.heading, color: "#fff" },
  reportCancel: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  reportCancelText: { fontSize: 15, fontWeight: "700", color: "#666" },
});
