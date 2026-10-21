import { doc, getDoc } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Image, Platform,
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { uploadFile } from "../utils/upload";
import * as ImagePicker from "expo-image-picker";
import { CATEGORIES, normalizeCategory } from "../constants/listings";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, RADIUS } from "../constants/theme";
import GradientButton from "../components/GradientButton";

const GREEN = COLORS.primary;

const LISTING_TYPES = [
  { id: 'sell',   label: 'For Sale',    icon: 'pricetag-outline',        color: COLORS.sell,   bg: COLORS.sellBg },
  { id: 'buy',    label: 'Looking For', icon: 'search-outline',          color: COLORS.buy,    bg: COLORS.buyBg },
  { id: 'barter', label: 'Barter',      icon: 'swap-horizontal-outline', color: COLORS.barter, bg: COLORS.barterBg },
  { id: 'donate', label: 'Donate',      icon: 'gift-outline',            color: COLORS.donate, bg: COLORS.donateBg },
];


const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

const CAMPUS_LOCATIONS = [
  "Dormitory", "Admin Office", "Library", "Main Gate", "Other",
];


export default function CreateListingScreen({ navigation, route }) {
  // When an existing listing is passed in, the screen works in EDIT mode.
  const editListing = route?.params?.editListing || null;
  const isEditing = !!editListing;
  const [listingType, setListingType]       = useState(editListing?.type || "sell");
  const [title, setTitle]                   = useState(editListing?.name || editListing?.title || "");
  const [description, setDescription]       = useState(editListing?.description || "");
  const [specifications, setSpecifications] = useState(editListing?.specifications || "");
  const [price, setPrice]                   = useState(editListing?.price ? String(editListing.price) : "");
  const [category, setCategory]             = useState(normalizeCategory(editListing?.category));
  const [condition, setCondition]           = useState(editListing?.condition || "");
  const [location, setLocation]             = useState(editListing?.location || "");
  const [contactNumber, setContactNumber]   = useState(editListing?.contactNumber || "");
  // Existing images are remote URLs; newly picked ones are local file URIs.
  const [images, setImages]                 = useState(editListing?.images || (editListing?.image ? [editListing.image] : []));
  const [loading, setLoading]               = useState(false);

  const activeType = LISTING_TYPES.find((t) => t.id === listingType);

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
      quality: 0.7,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newUris]);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed", "Please allow access to your camera."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri]);
  };

  const showImageOptions = () => {
    Alert.alert("Add Photo", "Choose an option", [
      { text: "📷 Take Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Gallery", onPress: pickImages },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index));

  const uploadImage = async (uri) => {
    const filename = `listings/${auth.currentUser.uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    return uploadFile(uri, filename);
  };

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
    if (images.length === 0)        { Alert.alert("Photo required", "Please add at least one photo of your item."); return; }
    if (!title.trim())              { Alert.alert("Missing info", "Please enter a title."); return; }
    if (!description.trim())        { Alert.alert("Missing info", "Please enter a description."); return; }
    if (listingType === "sell" && !price) { Alert.alert("Missing info", "Please enter a price."); return; }
    if (!category)                  { Alert.alert("Missing info", "Please select a category."); return; }
    if (!condition)                 { Alert.alert("Missing info", "Please select a condition."); return; }
    if (!location)                  { Alert.alert("Missing info", "Please select a meet-up location."); return; }
    if (!contactNumber.trim())      { Alert.alert("Missing info", "Please enter your contact number."); return; }

    setLoading(true);
    try {
      // Only upload images that are new local files. Existing ones are already
      // remote URLs (start with http) and should be kept as-is.
      const imageUrls = await Promise.all(
        images.map((uri) => (uri.startsWith("http") ? Promise.resolve(uri) : uploadImage(uri)))
      );

      const payload = {
        type: listingType, title: title.trim(), name: title.trim(),
        description: description.trim(),
        specifications: specifications.trim(),
        price: listingType === "sell" ? Number(price) : 0,
        category, condition, location, contactNumber: contactNumber.trim(),
        image: imageUrls[0], images: imageUrls,
      };

      if (isEditing) {
        // Edited listings go back for admin review
        await updateDoc(doc(db, "listings", editListing.id), {
          ...payload,
          status: "pending",
          updatedAt: serverTimestamp(),
        });
        Alert.alert(
          "✅ Changes Submitted",
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
    } finally { setLoading(false); }
  };

  const showPrice = listingType === 'sell' || listingType === 'buy';

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title={isEditing ? "Edit Listing" : "Create Listing"}
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Home" }); }}
        border
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Listing Type */}
          <Text style={styles.sectionLabel}>Listing Type</Text>
          <View style={styles.typeRow}>
            {LISTING_TYPES.map((type) => {
              const isActive = listingType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  activeOpacity={0.8}
                  style={[styles.typeBtn, isActive && { backgroundColor: type.bg, borderColor: type.color }]}
                  onPress={() => setListingType(type.id)}
                >
                  <Ionicons name={type.icon} size={20} color={isActive ? type.color : COLORS.textMuted} style={{ marginBottom: 4 }} />
                  <Text style={[styles.typeBtnLabel, isActive && { color: type.color }]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Photos */}
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <Text style={styles.required}>required</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImg} />
                {index === 0 && (
                  <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Cover</Text></View>
                )}
                <TouchableOpacity style={styles.removePhotoBtn} activeOpacity={0.7} onPress={() => removeImage(index)}>
                  <Ionicons name="close" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addPhotoBtn} activeOpacity={0.7} onPress={showImageOptions}>
              <Ionicons name="camera" size={26} color={GREEN} style={{ marginBottom: 4 }} />
              <Text style={styles.addPhotoText}>{images.length === 0 ? "Add Photos" : "Add More"}</Text>
              {images.length > 0 && <Text style={styles.addPhotoSub}>{images.length} added</Text>}
            </TouchableOpacity>
          </ScrollView>

          {/* Title */}
          <Text style={styles.sectionLabel}>Title</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Canon EOS Camera, Calculus Book"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <View style={[styles.inputWrapper, { height: 110, alignItems: "flex-start" }]}>
            <TextInput
              style={[styles.input, { paddingTop: 14, height: 110 }]}
              placeholder="Describe your item — condition, specs, reason for selling..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
            />
          </View>
          <Text style={styles.charCount}>{description.length}/500</Text>

          {/* Specifications (optional, flexible per item) */}
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Specifications</Text>
            <Text style={styles.required}>optional</Text>
          </View>
          <View style={[styles.inputWrapper, { height: 90, alignItems: "flex-start" }]}>
            <TextInput
              style={[styles.input, { paddingTop: 14, height: 90 }]}
              placeholder="Any extra details — e.g. cable length: 2 meters, RAM: 8GB, size: Medium, color: Blue..."
              placeholderTextColor={COLORS.textMuted}
              value={specifications}
              onChangeText={setSpecifications}
              multiline
              maxLength={300}
            />
          </View>
          <Text style={styles.charCount}>{specifications.length}/300</Text>

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

          {/* Meet-up Location */}
          <Text style={styles.sectionLabel}>Meet-up Location on Campus</Text>
          <View style={styles.chipGrid}>
            {CAMPUS_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                activeOpacity={0.8}
                style={[styles.chip, location === loc && styles.chipActive]}
                onPress={() => setLocation(loc)}
              >
                <Ionicons name="location-sharp" size={13} color={location === loc ? "#fff" : COLORS.textMuted} style={{ marginRight: 4 }} />
                <Text style={[styles.chipLabel, location === loc && styles.chipLabelActive]}>{loc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contact Number */}
          <Text style={styles.sectionLabel}>Contact Number</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={17} color={COLORS.textMuted} style={{ marginRight: 10 }} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="09XXXXXXXXX"
              placeholderTextColor={COLORS.textMuted}
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          {/* Live Preview Hint */}
          <View style={styles.previewHint}>
            <View style={[styles.previewDot, { backgroundColor: activeType?.color }]} />
            <Text style={styles.previewHintText}>
              This will post as a <Text style={{ fontWeight: "800", color: activeType?.color }}>{activeType?.label}</Text> listing
            </Text>
          </View>

          {/* Submit */}
          <GradientButton
            title={isEditing ? "Save Changes" : "Post Listing"}
            icon={isEditing ? "save-outline" : "rocket-outline"}
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: 14 }}
          />

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { paddingHorizontal: 16, paddingTop: 6 },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 },
  sectionLabel: { fontSize: 14.5, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 10, marginTop: 18 },
  required: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  typeBtnLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary },
  photosRow: { flexDirection: "row", marginBottom: 4 },
  photoThumb: { width: 96, height: 96, borderRadius: RADIUS.md, marginRight: 10, overflow: "hidden", position: "relative" },
  photoThumbImg: { width: "100%", height: "100%" },
  primaryBadge: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(27,107,58,0.88)", paddingVertical: 4, alignItems: "center" },
  primaryBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  removePhotoBtn: { position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  addPhotoBtn: { width: 96, height: 96, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primaryLighter, borderStyle: "dashed", backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center" },
  addPhotoText: { fontSize: 11.5, fontWeight: "700", color: GREEN },
  addPhotoSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  pesoSign: { fontSize: 17, marginRight: 8, color: COLORS.textSecondary },
  charCount: { fontSize: 11, color: COLORS.textMuted, textAlign: "right", marginTop: 4 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt },
  chipActive: { backgroundColor: GREEN },
  chipIcon: { fontSize: 14, marginRight: 5 },
  chipLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600" },
  chipLabelActive: { color: "#fff", fontWeight: "700" },
  conditionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  conditionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt },
  conditionBtnActive: { backgroundColor: GREEN },
  conditionLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600" },
  conditionLabelActive: { color: "#fff", fontWeight: "700" },
  previewHint: { flexDirection: "row", alignItems: "center", marginTop: 24, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 14 },
  previewDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  previewHintText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  submitBtn: { borderRadius: RADIUS.md, height: 52, alignItems: "center", justifyContent: "center", marginTop: 14, backgroundColor: GREEN },
  submitLoading: { flexDirection: "row", alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
