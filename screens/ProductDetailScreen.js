import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Image, Alert, Linking, Share,
  Dimensions, Modal, FlatList, Platform, TextInput, ActivityIndicator,} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import {
  doc, deleteDoc, getDoc, setDoc, collection, addDoc,
  serverTimestamp, updateDoc, increment, query, where, getDocs,
} from "firebase/firestore";
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const TYPE_COLORS = { sell: GREEN, buy: "#2980b9", barter: "#e67e22", donate: "#e74c3c" };
const TYPE_LABELS = { sell: "🏷️ For Sale", buy: "🔍 Looking For", barter: "🔄 For Barter", donate: "🎁 Free" };

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
  const typeColor = TYPE_COLORS[product.type] || GREEN;

  useEffect(() => {
    const checkCart = async () => {
      try {
        const cartDoc = await getDoc(doc(db, "users", currentUser.uid, "cart", product.id));
        setInCart(cartDoc.exists());
      } catch (e) {}
    };
    checkCart();
  }, []);

  const toggleCart = async (item) => {
    try {
      const cartRef = doc(db, "users", currentUser.uid, "cart", product.id);
      if (inCart) { await deleteDoc(cartRef); setInCart(false); }
      else {
        await setDoc(cartRef, { listingId: product.id, name: product.name, price: product.price || 0, type: product.type, location: product.location || "", addedAt: serverTimestamp() });
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

  const handleCall = () => Linking.openURL(`tel:${product.contactNumber}`).catch(() => Alert.alert("Error", "Could not open phone app."));

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
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={[styles.header, { paddingTop: STATUSBAR_TOP + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Home"); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {!isOwner && (
            <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={openReport}>
              <Ionicons name="flag-outline" size={19} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          {images.length > 1 ? (
            <>
              <FlatList
                data={images}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
                onMomentumScrollEnd={(e) => setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.95} onPress={() => openFullscreen(index)}>
                    <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
              <View style={styles.dotsRow}>
                {images.map((_, i) => <View key={i} style={[styles.dot, activeImageIndex === i && styles.dotActive]} />)}
              </View>
              <View style={styles.imageCountBadge}>
                <Ionicons name="images" size={11} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.imageCountText}>{activeImageIndex + 1}/{images.length}</Text>
              </View>
            </>
          ) : images.length === 1 ? (
            <TouchableOpacity activeOpacity={0.95} onPress={() => openFullscreen(0)}>
              <Image source={{ uri: images[0] }} style={styles.galleryImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 72 }}>🛍️</Text>
              <Text style={{ color: "#aaa", marginTop: 8, fontSize: 13 }}>No photo available</Text>
            </View>
          )}

          <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.typeBadgeText}>{TYPE_LABELS[product.type] || "🏷️ For Sale"}</Text>
          </View>
          {isSold && (
            <View style={styles.soldBanner}>
              <View style={styles.soldBannerPill}>
                <Text style={styles.soldBannerText}>SOLD</Text>
              </View>
            </View>
          )}
          {images.length > 0 && (
            <View style={styles.expandHint}>
              <Ionicons name="expand" size={11} color="rgba(255,255,255,0.85)" style={{ marginRight: 4 }} />
              <Text style={styles.expandHintText}>Tap to expand</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.priceBlock}>
              {isSold && <View style={styles.soldPill}><Text style={styles.soldPillText}>SOLD</Text></View>}
              {product.type === "donate" ? <Text style={[styles.price, { color: "#e74c3c" }]}>FREE</Text>
                : product.type === "barter" ? <Text style={[styles.price, { color: "#e67e22" }]}>Barter</Text>
                : product.type === "buy" ? <Text style={[styles.price, { color: "#2980b9" }]}>Wanted</Text>
                : <Text style={styles.price}>₱{product.price?.toLocaleString()}</Text>}
            </View>
          </View>

          <View style={styles.pillsRow}>
            {product.condition && <View style={styles.pill}><Text style={styles.pillText}>📦 {product.condition}</Text></View>}
            {product.category && <View style={styles.pill}><Text style={styles.pillText}>🏷 {product.category}</Text></View>}
            {product.location && <View style={styles.pill}><Text style={styles.pillText}>📍 {product.location}</Text></View>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.description}>{product.description || "No description provided."}</Text>
          </View>

          {product.specifications ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Specifications</Text>
              <Text style={styles.description}>{product.specifications}</Text>
            </View>
          ) : null}

          <View style={[styles.card, { padding: 0 }]}>
            <Text style={[styles.cardTitle, { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }]}>Details</Text>
            <DetailRow icon="cube-outline" label="Condition" value={product.condition || "Not specified"} />
            <DetailRow icon="pricetag-outline" label="Category" value={product.category || "Not specified"} />
            <DetailRow icon="bookmark-outline" label="Type" value={TYPE_LABELS[product.type] || "For Sale"} />
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
                <Image source={{ uri: product.sellerPhoto }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, { backgroundColor: GREEN, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff" }}>{product.sellerName?.[0]?.toUpperCase() || "?"}</Text>
                </View>
              )}
              <View>
                <Text style={styles.sellerName}>{product.sellerName || "Anonymous"}</Text>
                <Text style={styles.sellerSub}>✅ SLSU Student</Text>
              </View>
            </View>
            <View style={styles.viewProfileBtn}>
              <Text style={styles.viewProfileText}>View Profile</Text>
              <Ionicons name="chevron-forward" size={13} color={GREEN} />
            </View>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <Modal visible={fullscreenVisible} transparent animationType="fade" onRequestClose={() => setFullscreenVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <TouchableOpacity style={styles.fullscreenClose} activeOpacity={0.7} onPress={() => setFullscreenVisible(false)}>
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
                <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />
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
        <View style={[styles.bottomBar, { paddingBottom: 14 + insets.bottom }]}>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.85} onPress={() => navigation.navigate("CreateListing", { editListing: product })} disabled={marking || deleting}>
            <Ionicons name="create-outline" size={19} color={GREEN} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.markSoldBtn, isSold && styles.markActiveBtn, (marking || deleting) && { opacity: 0.6 }]} activeOpacity={0.85} onPress={handleMarkSold} disabled={marking || deleting}>
            <Text style={styles.markSoldBtnText}>{marking ? "⏳ Updating..." : isSold ? "🟢 Mark Active" : "✅ Mark as Sold"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.deleteIconBtn, deleting && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleDelete} disabled={deleting || marking}>
            <Ionicons name="trash-outline" size={22} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: 14 + insets.bottom }]}>
          {isSold ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleMessageSeller}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Ask if Still Available</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[styles.outlineBtn, inCart && styles.outlineBtnActive]} activeOpacity={0.8} onPress={toggleCart}>
                <Ionicons name={inCart ? "cart" : "cart-outline"} size={18} color={GREEN} style={{ marginRight: 6 }} />
                <Text style={styles.outlineBtnText}>{inCart ? "In Cart" : "Add to Cart"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleMessageSeller}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Message Seller</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={closeReport}>
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
  safe: { flex: 1, backgroundColor: LIGHT_BG },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  imageContainer: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.5, backgroundColor: "#1a1a1a" },
  galleryImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.5 },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F0F0" },
  dotsRow: { position: "absolute", bottom: 44, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotActive: { backgroundColor: "#fff", width: 20, borderRadius: 3 },
  imageCountBadge: { position: "absolute", top: 14, right: 14, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center" },
  imageCountText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  typeBadge: { position: "absolute", bottom: 14, left: 14, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, elevation: 2 },
  typeBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  soldBanner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  soldBannerPill: { backgroundColor: "#e74c3c", paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12 },
  soldBannerText: { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: 4 },
  soldPill: { backgroundColor: "#FDECEA", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  soldPillText: { color: "#e74c3c", fontSize: 10, fontWeight: "800" },
  cartBubbleActive: { backgroundColor: "#E8F5EC" },
  outlineBtnActive: { backgroundColor: "#E8F5EC" },
  expandHint: { position: "absolute", top: 14, left: "50%", marginLeft: -55, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", alignItems: "center" },
  expandHintText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600" },
  fullscreenClose: { position: "absolute", top: 52, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  fullscreenCounter: { position: "absolute", top: 58, left: 0, right: 0, zIndex: 10, alignItems: "center" },
  fullscreenDots: { position: "absolute", bottom: 48, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  content: { paddingHorizontal: 18, paddingTop: 22 },
  titleBlock: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  productName: { fontSize: 23, fontWeight: "800", color: "#111", flex: 1, marginRight: 14, lineHeight: 30 },
  priceBlock: { alignItems: "flex-end" },
  price: { fontSize: 24, fontWeight: "900", color: GREEN },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  pill: { backgroundColor: "#E8F0E4", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 12, color: GREEN, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#EAEAEA", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  description: { fontSize: 14, color: "#444", lineHeight: 22 },
  detailRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 },
  detailIconBox: { width: 28, alignItems: "center" },
  detailLabel: { fontSize: 13, color: "#aaa", width: 76, fontWeight: "500" },
  detailValue: { fontSize: 13, color: "#222", fontWeight: "600", flex: 1 },
  sellerCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#EAEAEA", elevation: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  sellerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  sellerAvatar: { width: 52, height: 52, borderRadius: 26 },
  sellerName: { fontSize: 15, fontWeight: "800", color: "#111", marginBottom: 3 },
  sellerSub: { fontSize: 12, color: GREEN, fontWeight: "500" },
  viewProfileBtn: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#E8F5EC", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  viewProfileText: { fontSize: 12, color: GREEN, fontWeight: "700" },
  bottomBar: { flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0", elevation: 8 },
  outlineBtn: { flex: 1, flexDirection: "row", height: 54, borderRadius: 16, borderWidth: 2, borderColor: GREEN, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  outlineBtnText: { fontSize: 13, fontWeight: "700", color: GREEN },
  primaryBtn: { flex: 1.3, flexDirection: "row", height: 54, borderRadius: 16, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  primaryBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  editBtn: { flexDirection: "row", gap: 5, paddingHorizontal: 14, height: 54, borderRadius: 16, borderWidth: 2, borderColor: GREEN, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  editBtnText: { fontSize: 14, fontWeight: "700", color: GREEN },
  markSoldBtn: { flex: 1, height: 54, borderRadius: 16, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  markActiveBtn: { backgroundColor: "#2980b9" },
  markSoldBtnText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  deleteIconBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },

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
