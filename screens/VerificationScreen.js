import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import KeyboardScrollView from '../components/KeyboardScrollView';
import { Alert } from '../components/AppAlert';
import Ionicons from "@expo/vector-icons/Ionicons";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../firebaseConfig";
import { uploadFile } from "../utils/upload";
import ScreenHeader from "../components/ScreenHeader";
import { RADIUS, FONTS } from "../constants/theme";
import { useTheme } from '../context/ThemeContext';


// No email step: every account already signed up with a verified SLSU email
// (see constants/school.js), so only the student ID is checked here.
const STEPS = [
  { id: 1, title: "Student ID Number", icon: "card" },
  { id: 2, title: "ID Photo", icon: "camera" },
];

export default function VerificationScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [currentStep, setCurrentStep] = useState(1);
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
      { text: "Take Photo", icon: "camera", onPress: takeIdPhoto },
      { text: "Choose from Gallery", icon: "images", onPress: pickIdPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStudentId()) return;
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
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
          schoolEmail: (user.email || "").toLowerCase(),
          studentId: studentId.trim(),
          idPhotoUrl,
          status: "pending",
          submittedAt: serverTimestamp(),
        },
        verificationStatus: "pending",
      });
      Alert.alert("Submitted!", "Your verification is being reviewed. You'll be notified once approved. This usually takes 1-2 days.", [
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
        <KeyboardScrollView contentContainerStyle={styles.container}>

          {/* Rejection notice — shown if a previous submission was not approved */}
          {verifStatus === "rejected" && (
            <View style={styles.rejectBanner}>
              <View style={styles.rejectIconCircle}>
                <Ionicons name="alert-circle" size={22} color={COLORS.error} />
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
              <Ionicons name="hourglass-outline" size={20} color={COLORS.warning} style={{ marginRight: 10 }} />
              <Text style={styles.pendingText}>
                Your verification is under review. You'll be notified once an admin has checked it.
              </Text>
            </View>
          )}

          {/* The SLSU email was already confirmed at sign-up */}
          <View style={styles.emailDone}>
            <Ionicons name="mail" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emailDoneLabel}>SLSU email verified</Text>
              <Text style={styles.emailDoneValue} numberOfLines={1}>{user?.email}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
          </View>

          {/* Progress bar */}
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Step {currentStep} of {STEPS.length}</Text>
            <Text style={styles.progressPct}>{Math.round(((currentStep - 1) / STEPS.length) * 100)}% done</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(currentStep / STEPS.length) * 100}%` }]} />
          </View>

          {/* Progress Steps */}
          <View style={styles.stepsRow}>
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, currentStep >= step.id && styles.stepCircleActive, currentStep > step.id && styles.stepCircleDone]}>
                    {currentStep > step.id ? (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    ) : (
                      <Ionicons name={step.icon} size={16} color={currentStep >= step.id ? COLORS.primary : COLORS.textMuted} />
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
                <Ionicons name="card" size={34} color={COLORS.primary} />
              </View>
              <Text style={styles.stepTitle}>Student ID Number</Text>
              <Text style={styles.stepDesc}>Enter your official SLSU Student ID number as shown on your ID card.</Text>
              <Text style={styles.inputLabel}>Student ID Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="keypad-outline" size={19} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                <TextInput style={styles.input} placeholder="e.g. 2021-00001" placeholderTextColor={COLORS.textMuted} value={studentId} onChangeText={setStudentId} keyboardType="default" />
              </View>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={17} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>Your Student ID number can be found on your school ID card or COR.</Text>
              </View>
            </View>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIconCircle}>
                <Ionicons name="camera" size={34} color={COLORS.primary} />
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
                    <Ionicons name="card-outline" size={42} color={COLORS.primary} style={{ marginBottom: 10 }} />
                    <Text style={styles.photoPlaceholderText}>Tap to upload your Student ID</Text>
                    <Text style={styles.photoPlaceholderSub}>Camera or Gallery</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Example of a good ID photo, so fewer submissions get rejected */}
              <Text style={styles.exampleLabel}>A good photo looks like this</Text>
              <View style={styles.exampleCard}>
                <View style={styles.exampleHeader}>
                  <Ionicons name="school" size={14} color="#fff" />
                  <Text style={styles.exampleHeaderText}>SOUTHERN LUZON STATE UNIVERSITY</Text>
                </View>
                <View style={styles.exampleBody}>
                  <View style={styles.examplePhoto}>
                    <Ionicons name="person" size={30} color={COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={[styles.exampleLine, { width: '85%' }]} />
                    <View style={[styles.exampleLine, { width: '60%' }]} />
                    <View style={[styles.exampleLine, { width: '70%' }]} />
                  </View>
                </View>
                <View style={styles.exampleCheck}>
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                </View>
              </View>

              <View style={styles.tipsBox}>
                {[
                  ["sunny-outline", "Flat and well-lit, no glare or shadows"],
                  ["text-outline", "All text is clearly readable"],
                  ["person-circle-outline", "Your photo on the ID is visible"],
                  ["crop-outline", "The whole card fits in the frame"],
                ].map(([icon, text]) => (
                  <View key={text} style={styles.tipRow}>
                    <Ionicons name={icon} size={16} color={COLORS.warning} />
                    <Text style={styles.tipItem}>{text}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Verification Summary</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Ionicons name="mail-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>School Email</Text>
                  </View>
                  <Text style={styles.summaryValue} numberOfLines={1}>{user?.email}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Ionicons name="card-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>Student ID</Text>
                  </View>
                  <Text style={styles.summaryValue}>{studentId}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryLabelRow}>
                    <Ionicons name="camera-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={styles.summaryLabel}>ID Photo</Text>
                  </View>
                  <View style={styles.summaryStatusRow}>
                    <Ionicons name={idPhoto ? "checkmark-circle" : "close-circle"} size={15} color={idPhoto ? COLORS.primary : COLORS.error} style={{ marginRight: 4 }} />
                    <Text style={[styles.summaryValue, { flex: 0, color: idPhoto ? COLORS.primary : COLORS.error }]}>{idPhoto ? "Uploaded" : "Not yet"}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.btnRow}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backStepBtn} activeOpacity={0.8} onPress={() => setCurrentStep(currentStep - 1)}>
                <Ionicons name="arrow-back" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.backStepBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {currentStep < STEPS.length ? (
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
        </KeyboardScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  // Rejection banner
  rejectBanner: { flexDirection: "row", backgroundColor: COLORS.errorLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 20, gap: 12 },
  rejectIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  rejectTitle: { fontSize: 14, fontFamily: FONTS.heading, color: COLORS.error, marginBottom: 3 },
  rejectReason: { fontSize: 13, color: COLORS.error, lineHeight: 19, marginBottom: 4 },
  rejectHint: { fontSize: 12, color: COLORS.error, fontStyle: "italic" },

  // Pending banner
  pendingBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.warningLight, borderRadius: RADIUS.lg, padding: 13, marginBottom: 20 },
  pendingText: { flex: 1, fontSize: 12.5, color: COLORS.warning, lineHeight: 18 },
  emailDone: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 20 },
  emailDoneLabel: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  emailDoneValue: { fontSize: 13.5, color: COLORS.textPrimary, marginTop: 1 },
  stepsRow: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
  stepItem: { alignItems: "center", flex: 1 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: 6, borderWidth: 2, borderColor: COLORS.border },
  stepCircleActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  stepCircleDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepLabel: { fontSize: 10.5, color: COLORS.textMuted, textAlign: "center", fontWeight: "500" },
  stepLabelActive: { color: COLORS.primary, fontWeight: "700" },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginBottom: 20 },
  stepLineActive: { backgroundColor: COLORS.primary },
  stepContent: { alignItems: "center", marginBottom: 24 },
  stepIconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  stepTitle: { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 8, textAlign: "center" },
  stepDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 10 },
  inputLabel: { fontSize: 13.5, fontWeight: "600", color: COLORS.textPrimary, alignSelf: "flex-start", marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52, width: "100%" },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.md, padding: 14, marginTop: 16, width: "100%" },
  infoText: { fontSize: 12.5, color: COLORS.textSecondary, flex: 1, lineHeight: 18 },
  photoBox: { width: "100%", height: 200, borderRadius: RADIUS.lg, backgroundColor: COLORS.surfaceAlt, borderWidth: 2, borderColor: COLORS.borderStrong, borderStyle: "dashed", overflow: "hidden", marginBottom: 16 },
  idPhotoPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary },
  photoPlaceholderSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  changePhotoBtn: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  changePhotoText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  tipsBox: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 16, width: "100%", gap: 8 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipItem: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 18 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressText: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  progressPct: { fontSize: 12.5, color: COLORS.textMuted },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceAlt, overflow: "hidden", marginBottom: 20 },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.primary },
  exampleLabel: { alignSelf: "flex-start", fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8 },
  exampleCard: { width: "100%", borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", marginBottom: 14 },
  exampleHeader: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 7 },
  exampleHeaderText: { color: "#fff", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
  exampleBody: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  examplePhoto: { width: 56, height: 68, borderRadius: 8, backgroundColor: COLORS.surfaceAlt, alignItems: "center", justifyContent: "center" },
  exampleLine: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceAlt },
  exampleCheck: { position: "absolute", top: 34, right: 10 },
  summaryBox: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, width: "100%", borderWidth: 1, borderColor: COLORS.border },
  summaryTitle: { fontSize: 15, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  summaryLabelRow: { flexDirection: "row", alignItems: "center" },
  summaryLabel: { fontSize: 13, color: COLORS.textMuted },
  summaryValue: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary, flex: 1, textAlign: "right" },
  summaryStatusRow: { flexDirection: "row", alignItems: "center" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backStepBtn: { flex: 1, flexDirection: "row", height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  backStepBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.primary },
  nextBtn: { flex: 2, flexDirection: "row", height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  nextBtnText: { fontSize: 15.5, fontWeight: "700", color: "#fff" },
});
