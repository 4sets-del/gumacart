import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Image, Platform,
} from 'react-native';
import { MEETUP_SPOTS } from '../constants/school';
import CoachMark from '../components/CoachMark';
import { useScreenTour } from '../utils/useScreenTour';
import PostTypeSheet, { postTypeMeta } from '../components/PostTypeSheet';
import KeyboardScrollView from '../components/KeyboardScrollView';
import { Alert } from '../components/AppAlert';
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, deleteField } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { uploadFile } from "../utils/upload";
import * as ImagePicker from "expo-image-picker";
import { CATEGORIES, normalizeCategory } from "../constants/listings";
import ScreenHeader from "../components/ScreenHeader";
import { RADIUS, FONTS } from "../constants/theme";
import { useTheme } from '../context/ThemeContext';
import GradientButton from "../components/GradientButton";
import { ProductCard } from "../components/ProductCard";




const MAX_PHOTOS = 6;

// Small red message shown under a field after a failed "Post" attempt.
function FieldError({ msg }) {
  const { COLORS, styles } = useTheme(createStyles);
  if (!msg) return null;
  return (
    <View style={styles.fieldError}>
      <Ionicons name="alert-circle" size={14} color={COLORS.error} />
      <Text style={styles.fieldErrorText}>{msg}</Text>
    </View>
  );
}

const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

const CAMPUS_LOCATIONS = MEETUP_SPOTS;


export default function CreateListingScreen({ navigation, route }) {
  const { COLORS, styles } = useTheme(createStyles);
  // When an existing listing is passed in, the screen works in EDIT mode.
  const editListing = route?.params?.editListing || null;
  const isEditing = !!editListing;
  const [listingType, setListingType]       = useState(editListing?.type || route?.params?.type || "sell");
  const [title, setTitle]                   = useState(editListing?.name || editListing?.title || "");
  const [description, setDescription]       = useState(editListing?.description || "");
  const [price, setPrice]                   = useState(editListing?.price ? String(editListing.price) : "");
  // How many identical items the seller has (e.g. food, crafts, shirts).
  const [quantity, setQuantity]             = useState(Math.max(1, Number(editListing?.quantity) || 1));
  const [category, setCategory]             = useState(normalizeCategory(editListing?.category));
  const [condition, setCondition]           = useState(editListing?.condition || "");
  // Meet-up spot: one of the campus spots, or "Other" with the place typed in.
  const initialPlace = editListing?.location || "";
  const knownSpot = CAMPUS_LOCATIONS.includes(initialPlace) && initialPlace !== "Other";
  const [spotChoice, setSpotChoice]         = useState(knownSpot ? initialPlace : initialPlace ? "Other" : "");
  const [otherPlace, setOtherPlace]         = useState(knownSpot || initialPlace === "Other" ? "" : initialPlace);
  const location = spotChoice === "Other" ? otherPlace.trim() : spotChoice;
  // Existing images are remote URLs; newly picked ones are local file URIs.
  const [images, setImages]                 = useState(editListing?.images || (editListing?.image ? [editListing.image] : []));
  const [loading, setLoading]               = useState(false);

  const typeInfo = postTypeMeta(COLORS, listingType);
  // New posts opened without a type (e.g. My Listings → Add New Listing)
  // start by asking for one, the same way the + Post tab does.
  const [typePicker, setTypePicker] = useState(!isEditing && !route?.params?.type);
  const [typeChosen, setTypeChosen] = useState(isEditing || !!route?.params?.type);

  // First-time mini tour of the form (after the type has been picked).
  const rootRef = useRef(null);
  const typeTagRef = useRef(null);
  const photosRef = useRef(null);
  const titleRef = useRef(null);
  const [tourVisible, finishTour] = useScreenTour('create', !typePicker);
  const tourSteps = useMemo(() => [
    { ref: typeTagRef, icon: 'swap-horizontal', title: 'Listing type', text: 'This is what you\'re posting. Tap Change to switch between For Sale, Looking For, Barter and Donate.' },
    { ref: photosRef, icon: 'camera', title: 'Photos', text: 'Add up to 6 clear, bright photos. The first one is the cover buyers see first.' },
    { ref: titleRef, icon: 'create', title: 'Title & details', text: 'Use a clear title, then describe the condition and anything buyers should know.' },
    { icon: 'eye', title: 'Price, meet-up & preview', text: 'Below, set the price (and quantity), choose a campus meet-up spot, and check the live preview. An admin approves new posts before they go live.' },
  ], []);

  useEffect(() => {
    const checkVerification = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.data();
        if (userData?.verificationStatus !== "verified" && userData?.role !== "admin") {
          Alert.alert(
            "Verification Required",
            "You need to be a verified SLSU student before you can create a listing.",
            [
              { text: "Verify Now", onPress: () => navigation.replace("Verification") },
              { text: "Cancel", onPress: () => navigation.goBack() },
            ],
          );
        }
      } catch (e) {
        console.log("Verification check error:", e.message);
      }
    };
    checkVerification();
  }, []);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - images.length,
      quality: 0.7,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed", "Please allow access to your camera."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  };

  const showImageOptions = () => {
    if (images.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit reached", `You can add up to ${MAX_PHOTOS} photos. Remove one to add another.`);
      return;
    }
    Alert.alert("Add Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImages },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index));

  const uploadImage = async (uri) => {
    const filename = `listings/${auth.currentUser.uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    return uploadFile(uri, filename);
  };

  // Field problems, shown inline under each field once "Post" was tapped.
  const [triedSubmit, setTriedSubmit] = useState(false);
  const errors = {};
  if (images.length === 0) errors.photos = "Add at least one photo of your item.";
  if (!title.trim()) errors.title = "Enter a title.";
  if (!description.trim()) errors.description = "Describe your item.";
  if (listingType === "sell" && !(Number(price) > 0)) errors.price = "Enter a price greater than 0.";
  if (!category) errors.category = "Pick a category.";
  if (!condition) errors.condition = "Pick a condition.";
  if (!spotChoice) errors.location = "Pick a meet-up location.";
  else if (!location) errors.location = "Type where to meet (e.g. Canteen).";
  const shownErrors = triedSubmit ? errors : {};

  const [uploadProgress, setUploadProgress] = useState(null); // { done, total } while posting

  const handleSubmit = async () => {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userDoc.data();
    if (userData?.verificationStatus !== "verified" && userData?.role !== "admin") {
      Alert.alert("Not Verified", "You need to verify your student ID before posting listings.", [
        { text: "Verify Now", onPress: () => navigation.navigate("Verification") },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    setTriedSubmit(true);
    if (Object.keys(errors).length > 0) {
      Alert.alert("Almost there", "Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      // Only upload images that are new local files. Existing ones are already
      // remote URLs (start with http) and should be kept as-is.
      // Upload new photos in parallel, counting each one as it finishes.
      const newCount = images.filter((uri) => !uri.startsWith("http")).length;
      let done = 0;
      setUploadProgress({ done, total: newCount });
      const imageUrls = await Promise.all(
        images.map((uri) => (uri.startsWith("http") ? Promise.resolve(uri) : uploadImage(uri).then((url) => {
          done += 1;
          setUploadProgress({ done, total: newCount });
          return url;
        })))
      );

      const payload = {
        type: listingType, title: title.trim(), name: title.trim(),
        description: description.trim(),
        price: listingType === "sell" ? Number(price) : 0,
        quantity: showQuantity ? quantity : 1,
        category, condition, location,
        image: imageUrls[0], images: imageUrls,
      };

      if (isEditing) {
        // Edited listings go back for admin review
        await updateDoc(doc(db, "listings", editListing.id), {
          ...payload,
          status: "pending",
          updatedAt: serverTimestamp(),
          contactNumber: deleteField(), // phone numbers are no longer shown
          // An expired listing being edited counts as renewed, so it isn't
          // expired again right after approval.
          ...(editListing.status === "expired" ? { createdAt: serverTimestamp(), expiryWarned: false } : {}),
        });
        Alert.alert(
          "Changes Submitted",
          "Your listing has been updated and is pending admin approval again. It will reappear once approved.",
          [{ text: "OK", onPress: () => navigation.navigate("Main", { screen: "Home" }) }]
        );
      } else {
        await addDoc(collection(db, "listings"), {
          ...payload,
          sellerId: auth.currentUser.uid,
          sellerName: auth.currentUser.displayName || "Anonymous",
          sellerPhoto: userData?.photoURL || auth.currentUser.photoURL || null,
          createdAt: serverTimestamp(), status: "pending",
        });
        Alert.alert(
          "✅ Submitted for Review",
          "Your listing has been submitted and is now pending admin approval. It will appear once approved.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      Alert.alert("Error", isEditing ? "Failed to update listing." : "Failed to post listing. Please try again.");
    } finally { setLoading(false); setUploadProgress(null); }
  };

  const showPrice = listingType === 'sell' || listingType === 'buy';
  const showQuantity = listingType === 'sell' || listingType === 'donate';

  return (
    <View style={styles.safe} ref={rootRef} collapsable={false}>
      <CoachMark visible={tourVisible} steps={tourSteps} onFinish={finishTour} originRef={rootRef} />
      <PostTypeSheet
        visible={typePicker}
        onClose={() => setTypePicker(false)}
        onPick={(t) => { setListingType(t); setTypeChosen(true); setTypePicker(false); }}
        selected={typeChosen ? listingType : undefined}
        title={isEditing ? "Change listing type" : "What do you want to post?"}
      />
      <ScreenHeader
        title={isEditing ? "Edit Listing" : "Create Listing"}
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Home" }); }}
        border
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={20}>
        <KeyboardScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Listing type: chosen on the Post sheet; "Change" reopens it. */}
          <TouchableOpacity
            ref={typeTagRef}
            collapsable={false}
            style={[styles.typeTag, { backgroundColor: typeInfo.bg, borderColor: typeInfo.color + '55' }]}
            activeOpacity={0.85}
            onPress={() => setTypePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Listing type: ${typeInfo.label}. Change`}
          >
            <View style={[styles.typeTagIcon, { backgroundColor: typeInfo.color }]}>
              <Ionicons name={typeInfo.icon} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.typeTagLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
              <Text style={styles.typeTagSub}>{typeInfo.sub}</Text>
            </View>
            <View style={styles.typeTagChange}>
              <Text style={[styles.typeTagChangeText, { color: typeInfo.color }]}>Change</Text>
            </View>
          </TouchableOpacity>

          {/* Photos */}
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <Text style={[styles.required, images.length >= MAX_PHOTOS && { color: COLORS.primary }]}>{images.length}/{MAX_PHOTOS}</Text>
          </View>
          <ScrollView ref={photosRef} collapsable={false} horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImg} />
                {index === 0 && (
                  <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Cover</Text></View>
                )}
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove photo" style={styles.removePhotoBtn} activeOpacity={0.7} onPress={() => removeImage(index)}>
                  <Ionicons name="close" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addPhotoBtn} activeOpacity={0.7} onPress={showImageOptions}>
              <Ionicons name="camera" size={26} color={COLORS.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.addPhotoText}>{images.length === 0 ? "Add Photos" : "Add More"}</Text>
              {images.length > 0 && <Text style={styles.addPhotoSub}>{images.length} added</Text>}
            </TouchableOpacity>
          </ScrollView>

          <FieldError msg={shownErrors.photos} />

          {/* Title */}
          <Text style={styles.sectionLabel}>Title</Text>
          <View style={styles.inputWrapper} ref={titleRef} collapsable={false}>
            <TextInput
              style={styles.input}
              placeholder="Item name"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </View>

          <FieldError msg={shownErrors.title} />

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <View style={[styles.inputWrapper, { height: 110, alignItems: "flex-start" }]}>
            <TextInput
              style={[styles.input, { paddingTop: 14, height: 110 }]}
              placeholder="Describe your item"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
            />
          </View>
          <Text style={styles.charCount}>{description.length}/500</Text>

          <FieldError msg={shownErrors.description} />

          {/* Price */}
          {showPrice && (
            <>
              <Text style={styles.sectionLabel}>{listingType === 'buy' ? 'Budget (₱)' : 'Price (₱)'}</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.pesoSign}>₱</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}

          <FieldError msg={shownErrors.price} />

          {/* Quantity */}
          {showQuantity && (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>How many do you have?</Text>
                <Text style={styles.required}>{quantity > 1 ? "sold one at a time" : "single item"}</Text>
              </View>
              <View style={styles.qtyRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease quantity" style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase quantity" style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.min(99, q + 1))}>
                  <Ionicons name="add" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chipGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                activeOpacity={0.8}
                style={[styles.chip, category === cat.name && styles.chipActive]}
                onPress={() => setCategory(cat.name)}
              >
                <Text style={styles.chipIcon}>{cat.emoji}</Text>
                <Text style={[styles.chipLabel, category === cat.name && styles.chipLabelActive]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldError msg={shownErrors.category} />

          {/* Condition */}
          <Text style={styles.sectionLabel}>Condition</Text>
          <View style={styles.conditionRow}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c}
                activeOpacity={0.8}
                style={[styles.conditionBtn, condition === c && styles.conditionBtnActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.conditionLabel, condition === c && styles.conditionLabelActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldError msg={shownErrors.condition} />

          {/* Meet-up Location */}
          <Text style={styles.sectionLabel}>Meet-up Location on Campus</Text>
          <View style={styles.chipGrid}>
            {CAMPUS_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                activeOpacity={0.8}
                style={[styles.chip, spotChoice === loc && styles.chipActive]}
                onPress={() => setSpotChoice(loc)}
              >
                <Ionicons name="location-sharp" size={13} color={spotChoice === loc ? "#fff" : COLORS.textMuted} style={{ marginRight: 4 }} />
                <Text style={[styles.chipLabel, spotChoice === loc && styles.chipLabelActive]}>{loc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {spotChoice === "Other" && (
            <View style={[styles.inputWrapper, { marginTop: 10 }]}>
              <Ionicons name="location-outline" size={17} color={COLORS.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Where on campus? e.g. Canteen"
                placeholderTextColor={COLORS.textMuted}
                value={otherPlace}
                onChangeText={setOtherPlace}
                maxLength={40}
              />
            </View>
          )}

          <FieldError msg={shownErrors.location} />

          <View style={styles.chatNote}>
            <Ionicons name="chatbubbles-outline" size={16} color={COLORS.primary} />
            <Text style={styles.chatNoteText}>Buyers contact you through GumaCart chat, so your phone number stays private.</Text>
          </View>

          {/* Live preview of how the listing card will look */}
          <Text style={styles.sectionLabel}>Preview</Text>
          <View style={styles.previewRow}>
            <ProductCard
              width={150}
              item={{
                id: "preview",
                name: title.trim() || "Your item title",
                price: Number(price) || 0,
                type: listingType,
                images,
                quantity,
                category,
                condition,
                location,
                sellerName: auth.currentUser?.displayName || "You",
                sellerPhoto: auth.currentUser?.photoURL || null,
                createdAt: new Date(),
              }}
            />
            <View style={styles.previewInfo}>
              <View style={[styles.previewDot, { backgroundColor: typeInfo.color }]} />
              <Text style={styles.previewHintText}>
                Posts as <Text style={{ fontFamily: FONTS.heading, color: typeInfo.color }}>{typeInfo.label}</Text>
                {category ? ` in ${category}` : ""}. An admin reviews it before it goes live.
              </Text>
            </View>
          </View>

          {/* Submit */}
          <GradientButton
            title={isEditing ? "Save Changes" : "Post Listing"}
            icon={isEditing ? "save-outline" : "rocket-outline"}
            onPress={handleSubmit}
            loading={loading}
            loadingText={
              uploadProgress && uploadProgress.done < uploadProgress.total
                ? `Uploading photo ${uploadProgress.done + 1} of ${uploadProgress.total}…`
                : "Saving…"
            }
            style={{ marginTop: 14 }}
          />

          <View style={{ height: 50 }} />
        </KeyboardScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { paddingHorizontal: 16, paddingTop: 6 },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 },
  sectionLabel: { fontSize: 14.5, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 10, marginTop: 18 },
  required: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
  chatNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryPale },
  chatNoteText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: COLORS.textSecondary },
  typeTag: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1.5 },
  typeTagIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  typeTagLabel: { fontSize: 16, fontFamily: FONTS.heading },
  typeTagSub: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 1 },
  typeTagChange: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface },
  typeTagChangeText: { fontSize: 13, fontWeight: "700" },
  photosRow: { flexDirection: "row", marginBottom: 4 },
  photoThumb: { width: 96, height: 96, borderRadius: RADIUS.md, marginRight: 10, overflow: "hidden", position: "relative" },
  photoThumbImg: { width: "100%", height: "100%" },
  primaryBadge: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(27,107,58,0.88)", paddingVertical: 4, alignItems: "center" },
  primaryBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  removePhotoBtn: { position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  addPhotoBtn: { width: 96, height: 96, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primaryLighter, borderStyle: "dashed", backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center" },
  addPhotoText: { fontSize: 11.5, fontWeight: "700", color: COLORS.primary },
  addPhotoSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  pesoSign: { fontSize: 17, marginRight: 8, color: COLORS.textSecondary },
  charCount: { fontSize: 11, color: COLORS.textMuted, textAlign: "right", marginTop: 4 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt },
  chipActive: { backgroundColor: COLORS.primary },
  chipIcon: { fontSize: 14, marginRight: 5 },
  chipLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600" },
  chipLabelActive: { color: "#fff", fontWeight: "700" },
  conditionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  conditionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt },
  conditionBtnActive: { backgroundColor: COLORS.primary },
  conditionLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600" },
  conditionLabelActive: { color: "#fff", fontWeight: "700" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.textPrimary, minWidth: 28, textAlign: "center" },
  previewRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  previewInfo: { flex: 1, flexDirection: "row", gap: 8, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 12 },
  fieldError: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  fieldErrorText: { fontSize: 12.5, color: COLORS.error, fontWeight: "600" },
  previewHint: { flexDirection: "row", alignItems: "center", marginTop: 24, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 14 },
  previewDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  previewHintText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  submitBtn: { borderRadius: RADIUS.md, height: 52, alignItems: "center", justifyContent: "center", marginTop: 14, backgroundColor: COLORS.primary },
  submitLoading: { flexDirection: "row", alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
