import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../firebaseConfig";
import { uploadFile } from "../utils/upload";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, RADIUS } from "../constants/theme";

const GREEN = COLORS.primary;

const STEPS = [
  { id: 1, title: "School Email", icon: "📧" },
  { id: 2, title: "Student ID Number", icon: "🪪" },
  { id: 3, title: "ID Photo", icon: "📷" },
];

export default function VerificationScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [schoolEmail, setSchoolEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [idPhoto, setIdPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  // Current verification status + rejection reason (if previously rejected)
  const [verifStatus, setVerifStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          setVerifStatus(d.verificationStatus || null);
          setRejectionReason(d.rejectionReason || d.verification?.reason || null);
        }
      } catch (e) {}
    };
    loadStatus();
  }, []);
  const user = auth.currentUser;

  const validateEmail = () => {
    if (!schoolEmail.trim()) { Alert.alert("Required", "Please enter your school email."); return false; }
    if (!schoolEmail.toLowerCase().endsWith("@slsu.edu.ph")) { Alert.alert("Invalid Email", "Please use your SLSU school email ending in @slsu.edu.ph"); return false; }
    return true;
  };

  const validateStudentId = () => {
    if (!studentId.trim()) { Alert.alert("Required", "Please enter your Student ID number."); return false; }
    if (studentId.trim().length < 6) { Alert.alert("Invalid ID", "Please enter a valid Student ID number."); return false; }
    return true;
  };

  const pickIdPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setIdPhoto(result.assets[0].uri);
  };

  const takeIdPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setIdPhoto(result.assets[0].uri);
  };

  const showPhotoOptions = () => {
    Alert.alert("Upload Student ID", "Choose an option", [
      { text: "📷 Take Photo", onPress: takeIdPhoto },
      { text: "🖼️ Choose from Gallery", onPress: pickIdPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateEmail()) return;
    if (currentStep === 2 && !validateStudentId()) return;
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleSubmit = async () => {
    if (!idPhoto) { Alert.alert("Required", "Please upload a photo of your Student ID."); return; }
    setLoading(true);
    try {
      const filename = `verifications/${user.uid}/student-id.jpg`;
      // Larger limit so the text on the ID stays readable for admins.
      const idPhotoUrl = await uploadFile(idPhoto, filename, { maxSize: 1800, quality: 0.8 });
      await updateDoc(doc(db, "users", user.uid), {
        verification: {
          schoolEmail: schoolEmail.trim().toLowerCase(),
          studentId: studentId.trim(),
          idPhotoUrl,
          status: "pending",
          submittedAt: serverTimestamp(),
        },
        verificationStatus: "pending",
      });
      Alert.alert("✅ Submitted!", "Your verification is being reviewed. You'll be notified once approved. This usually takes 1-2 days.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.log("Verification error:", e.message);
      Alert.alert("Error", "Failed to submit verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safe}>
      <ScreenHeader title="Student Verification" onBack={() => navigation.goBack()} border />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Rejection notice — shown if a previous submission was not approved */}
          {verifStatus === "rejected" && (
            <View style={styles.rejectBanner}>
              <View style={styles.rejectIconCircle}>
                <Ionicons name="alert-circle" size={22} color="#e74c3c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectTitle}>Verification Not Approved</Text>
                <Text style={styles.rejectReason}>
                  {rejectionReason || "Your previous submission could not be verified."}
                </Text>
                <Text style={styles.rejectHint}>
                  Please correct the issue and submit again below.
                </Text>
              </View>
            </View>
          )}

          {/* Pending notice */}
          {verifStatus === "pending" && (
            <View style={styles.pendingBanner}>
              <Ionicons name="hourglass-outline" size={20} color="#e67e22" style={{ marginRight: 10 }} />
              <Text style={styles.pendingText}>
                Your verification is under review. You'll be notified once an admin has checked it.
              </Text>
            </View>
          )}

          {/* Progress Steps */}
          <View style={styles.stepsRow}>
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, currentStep >= step.id && styles.stepCircleActive, currentStep > step.id && styles.stepCircleDone]}>
                    {currentStep > step.id ? (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    ) : (
                      <Text style={[styles.stepNum, currentStep >= step.id && styles.stepNumActive]}>{step.id}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, currentStep >= step.id && styles.stepLabelActive]}>{step.title}</Text>
                </View>
                {index < STEPS.length - 1 && (
                  <View style={[styles.stepLine, currentStep > step.id && styles.stepLineActive]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Step 1 */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIconCircle}>
                <Ionicons name="mail" size={34} color={GREEN} />
              </View>
              <Text style={styles.stepTitle}>School Email</Text>
              <Text style={styles.stepDesc}>Enter your official SLSU school email address to verify you're a student.</Text>
              <Text style={styles.inputLabel}>School Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={19} color="#888" style={{ marginRight: 10 }} />
                <TextInput style={styles.input} placeholder="yourname@slsu.edu.ph" placeholderTextColor="#A0A0A0" value={schoolEmail} onChangeText={setSchoolEmail} autoCapitalize="none" keyboardType="email-address" />
              </View>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={17} color={GREEN} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>Only @slsu.edu.ph email addresses are accepted. Contact your registrar if you don't have one.</Text>
              </View>
            </View>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIconCircle}>
                <Ionicons name="card" size={34} color={GREEN} />
              </View>
              <Text style={styles.stepTitle}>Student ID Number</Text>
              <Text style={styles.stepDesc}>Enter your official SLSU Student ID number as shown on your ID card.</Text>
              <Text style={styles.inputLabel}>Student ID Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="keypad-outline" size={19} color="#888" style={{ marginRight: 10 }} />
                <TextInput style={styles.input} placeholder="e.g. 2021-00001" placeholderTextColor="#A0A0A0" value={studentId} onChangeText={setStudentId} keyboardType="default" />
              </View>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={17} color={GREEN} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>Your Student ID number can be found on your school ID card or COR.</Text>
              </View>
            </View>
          )}

          {/* Step 3 */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIconCircle}>
                <Ionicons name="camera" size={34} color={GREEN} />
              </View>
              <Text style={styles.stepTitle}>Upload Student ID Photo</Text>
              <Text style={styles.stepDesc}>Take a clear photo of your SLSU Student ID card. Make sure all details are visible.</Text>

              <TouchableOpacity style={styles.photoBox} activeOpacity={0.85} onPress={showPhotoOptions}>
                {idPhoto ? (
                  <>
                    <Image source={{ uri: idPhoto }} style={styles.idPhotoPreview} />
                    <View style={styles.changePhotoBtn}>
                      <Ionicons name="camera" size={13} color="#fff" style={{ marginRight: 5 }} />
                      <Text style={styles.changePhotoText}>Change Photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="card-outline" size={42} color={GREEN} style={{ marginBottom: 10 }} />
                    <Text style={styles.photoPlaceholderText}>Tap to upload your Student ID</Text>
                    <Text style={styles.photoPlaceholderSub}>Camera or Gallery</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>📋 Tips for a clear photo:</Text>
                <Text style={styles.tipItem}>• Make sure the ID is flat and well-lit</Text>
                <Text style={styles.tipItem}>• All text must be clearly readable</Text>
                <Text style={styles.tipItem}>• Avoid glare or shadows on the ID</Text>
                <Text style={styles.tipItem}>• Your photo on the ID must be visible</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Verification Summary</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Ionicons name="mail-outline" size={14} color="#888" style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>School Email</Text>
                  </View>
                  <Text style={styles.summaryValue}>{schoolEmail}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Ionicons name="card-outline" size={14} color="#888" style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>Student ID</Text>
                  </View>
                  <Text style={styles.summaryValue}>{studentId}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Ionicons name="camera-outline" size={14} color="#888" style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>ID Photo</Text>
                  </View>
                  <View style={styles.summaryStatusRow}>
                    <Ionicons name={idPhoto ? "checkmark-circle" : "close-circle"} size={15} color={idPhoto ? GREEN : "#e74c3c"} style={{ marginRight: 4 }} />
                    <Text style={[styles.summaryValue, { flex: 0, color: idPhoto ? GREEN : "#e74c3c" }]}>{idPhoto ? "Uploaded" : "Not yet"}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.btnRow}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backStepBtn} activeOpacity={0.8} onPress={() => setCurrentStep(currentStep - 1)}>
                <Ionicons name="arrow-back" size={16} color={GREEN} style={{ marginRight: 4 }} />
                <Text style={styles.backStepBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {currentStep < 3 ? (
              <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.nextBtn, loading && { opacity: 0.7 }]} activeOpacity={0.85} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Submit Verification</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  // Rejection banner
  rejectBanner: { flexDirection: "row", backgroundColor: COLORS.errorLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 20, gap: 12 },
  rejectIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  rejectTitle: { fontSize: 14, fontWeight: "800", color: "#c0392b", marginBottom: 3 },
  rejectReason: { fontSize: 13, color: "#7b3029", lineHeight: 19, marginBottom: 4 },
  rejectHint: { fontSize: 12, color: "#a05a52", fontStyle: "italic" },

  // Pending banner
  pendingBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.warningLight, borderRadius: RADIUS.lg, padding: 13, marginBottom: 20 },
  pendingText: { flex: 1, fontSize: 12.5, color: "#8a5a20", lineHeight: 18 },
  stepsRow: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
  stepItem: { alignItems: "center", flex: 1 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: 6, borderWidth: 2, borderColor: COLORS.border },
  stepCircleActive: { backgroundColor: COLORS.primaryPale, borderColor: GREEN },
  stepCircleDone: { backgroundColor: GREEN, borderColor: GREEN },
  stepNum: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted },
  stepNumActive: { color: GREEN },
  stepLabel: { fontSize: 10.5, color: COLORS.textMuted, textAlign: "center", fontWeight: "500" },
  stepLabelActive: { color: GREEN, fontWeight: "700" },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginBottom: 20 },
  stepLineActive: { backgroundColor: GREEN },
  stepContent: { alignItems: "center", marginBottom: 24 },
  stepIconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  stepTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8, textAlign: "center" },
  stepDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 10 },
  inputLabel: { fontSize: 13.5, fontWeight: "600", color: COLORS.textPrimary, alignSelf: "flex-start", marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52, width: "100%" },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.md, padding: 14, marginTop: 16, width: "100%" },
  infoText: { fontSize: 12.5, color: COLORS.textSecondary, flex: 1, lineHeight: 18 },
  photoBox: { width: "100%", height: 200, borderRadius: RADIUS.lg, backgroundColor: COLORS.surfaceAlt, borderWidth: 2, borderColor: COLORS.borderStrong, borderStyle: "dashed", overflow: "hidden", marginBottom: 16 },
  idPhotoPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { fontSize: 14, fontWeight: "700", color: "#555" },
  photoPlaceholderSub: { fontSize: 12, color: "#999", marginTop: 4 },
  changePhotoBtn: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  changePhotoText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tipsBox: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 16, width: "100%" },
  tipsTitle: { fontSize: 13, fontWeight: "700", color: "#333", marginBottom: 8 },
  tipItem: { fontSize: 12, color: "#555", marginBottom: 4, lineHeight: 18 },
  summaryBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, width: "100%", borderWidth: 1, borderColor: COLORS.border },
  summaryTitle: { fontSize: 15, fontWeight: "800", color: "#111", marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  summaryLabelRow: { flexDirection: "row", alignItems: "center" },
  summaryLabel: { fontSize: 13, color: "#888" },
  summaryValue: { fontSize: 13, fontWeight: "600", color: "#111", flex: 1, textAlign: "right" },
  summaryStatusRow: { flexDirection: "row", alignItems: "center" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backStepBtn: { flex: 1, flexDirection: "row", height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: GREEN, alignItems: "center", justifyContent: "center" },
  backStepBtnText: { fontSize: 15, fontWeight: "700", color: GREEN },
  nextBtn: { flex: 2, flexDirection: "row", height: 52, borderRadius: RADIUS.md, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  nextBtnText: { fontSize: 15.5, fontWeight: "700", color: "#fff" },
});
