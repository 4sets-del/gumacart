import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { Alert } from '../components/AppAlert';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  updateProfile, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, deleteUser,
} from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { signOutUser } from "../utils/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { uploadFile } from "../utils/upload";
import { unregisterPushToken } from "../utils/notifications";
import { resetScreenTours } from "../utils/useScreenTour";
import AcademicFields from "../components/AcademicFields";
import Sheet, { FormField, SheetSection } from "../components/Sheet";
import ScreenHeader from "../components/ScreenHeader";
import { RADIUS, SHADOWS, FONTS, GRADIENTS } from "../constants/theme";
import { useTheme } from '../context/ThemeContext';


export default function SettingsScreen({ navigation }) {
  const { COLORS, styles, mode, setMode } = useTheme(createStyles);
  const user = auth.currentUser;

  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState(user?.displayName || "");
  const [address, setAddress] = useState("");
  const [age, setAge] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [notifMessages, setNotifMessages] = useState(true);
  const [notifFollowers, setNotifFollowers] = useState(true);
  const [notifReviews, setNotifReviews] = useState(true);
  const [notifListings, setNotifListings] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(true);
  const [muteAll, setMuteAll] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState(null);
  const [course, setCourse] = useState(null);
  const [yearLevel, setYearLevel] = useState(null);
  const [isFaculty, setIsFaculty] = useState(false);
  const insets = useSafeAreaInsets();
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  useEffect(() => {
    const loadVerificationStatus = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.data();
        setVerificationStatus(data?.verificationStatus || null);
        // Show the saved notification switches as soon as Settings opens.
        setNotifMessages(data?.notifPrefs?.messages !== false);
        setNotifFollowers(data?.notifPrefs?.followers !== false);
        setNotifReviews(data?.notifPrefs?.reviews !== false);
        setNotifListings(data?.notifPrefs?.listings !== false);
        setNotifAlerts(data?.notifPrefs?.alerts !== false);
        setMuteAll(data?.notifPrefs?.muteAll === true);
      } catch (e) {}
    };
    loadVerificationStatus();
  }, []);

  const loadProfileIntoForm = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      setName(data?.name || user?.displayName || "");
      setAddress(data?.address || "");
      setAge(data?.age ? String(data.age) : "");
      setCourse(data?.course || null);
      setYearLevel(data?.yearLevel || null);
      setIsFaculty(data?.role === "faculty");
      setPhotoURL(data?.photoURL || user?.photoURL || null);
      setNotifMessages(data?.notifPrefs?.messages !== false);
      setNotifFollowers(data?.notifPrefs?.followers !== false);
      setNotifReviews(data?.notifPrefs?.reviews !== false);
    } catch (e) {}
  };

  const openEditModal = async () => { await loadProfileIntoForm(); setShowEditModal(true); };

  // Profile photo, changed right away from the Edit Profile sheet.
  const [photoURL, setPhotoURL] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const savePhoto = async (url) => {
    await updateProfile(user, { photoURL: url });
    await updateDoc(doc(db, "users", user.uid), { photoURL: url });
    setPhotoURL(url);
  };

  const pickPhoto = async (source) => {
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert("Permission required", "Please allow access to continue."); return; }
      const options = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      setUploadingPhoto(true);
      const url = await uploadFile(result.assets[0].uri, `profiles/${user.uid}/avatar.jpg`, { maxSize: 600 });
      await savePhoto(url);
    } catch (e) {
      Alert.alert("Error", "Could not update your photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const changePhoto = () => {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", icon: "camera", onPress: () => pickPhoto("camera") },
      { text: "Choose from Gallery", icon: "images", onPress: () => pickPhoto("gallery") },
      photoURL ? { text: "Remove Photo", icon: "trash", style: "destructive", onPress: () => savePhoto(null).catch(() => {}) } : null,
      { text: "Cancel", style: "cancel" },
    ].filter(Boolean));
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter your name."); return; }
    setSavingProfile(true);
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(), address: address.trim(), age: age ? Number(age) : null,
        course: course || null,
        yearLevel: isFaculty ? null : yearLevel || null,
      });
      Alert.alert("Updated", "Your profile has been saved.");
      setShowEditModal(false);
    } catch (e) { Alert.alert("Error", "Failed to update profile."); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { Alert.alert("Missing fields", "Please fill in all password fields."); return; }
    if (newPassword.length < 6) { Alert.alert("Weak password", "New password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Mismatch", "New passwords do not match."); return; }
    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Password Changed", "Your password has been updated.");
      setShowPasswordModal(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) {
      let msg = "Failed to change password.";
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") msg = "Current password is incorrect.";
      else if (e.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
      Alert.alert("Error", msg);
    } finally { setChangingPassword(false); }
  };

  const handleNotifToggle = async (key, value, setter) => {
    setter(value);
    try { await updateDoc(doc(db, "users", user.uid), { [`notifPrefs.${key}`]: value }); } catch (e) {}
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => signOutUser().catch(() => {}) },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "This will permanently delete your account and all your data. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Forever", style: "destructive", onPress: () => {
        Alert.alert("Confirm Deletion", "Enter your password in the next screen to confirm.", [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => { setDeletePassword(""); setShowDeleteModal(true); } },
        ]);
      }},
    ]);
  };

  // Deletes the login itself. Firebase requires a recent sign-in for this,
  // hence the password. The onAccountDeleted Cloud Function then removes the
  // user's data (profile, listings, photos, reviews, follows...).
  const handleConfirmDelete = async () => {
    if (!deletePassword) { Alert.alert("Password required", "Enter your password to confirm."); return; }
    setDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      await unregisterPushToken(user.uid);
      await deleteUser(user);
      // Signed out automatically; the app returns to the Welcome screen.
    } catch (e) {
      let msg = "Could not delete your account. Please try again.";
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") msg = "Password is incorrect.";
      else if (e.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
      Alert.alert("Error", msg);
      setDeleting(false);
    }
  };

  return (
    <View style={styles.safe}>

      <ScreenHeader
        title="Settings"
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Profile" }); }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <SettingRow icon="person" iconColor="#2563EB" label="Edit Profile" sub="Name, course, year, address" onPress={openEditModal} />
          {verificationStatus !== "verified" && (
            <SettingRow
              icon="school"
              iconColor="#16A34A"
              label="Verify Student ID"
              sub={verificationStatus === "pending" ? "Pending review" : "Get verified to start posting"}
              onPress={() => navigation.navigate("Verification")}
            />
          )}
          <SettingRow icon="lock-closed" iconColor="#7C3AED" label="Change Password" sub="Update your account password" onPress={() => setShowPasswordModal(true)} isLast />
        </View>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={[styles.card, styles.appearanceCard]}>
          {[
            { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
            { id: 'light', label: 'Light', icon: 'sunny-outline' },
            { id: 'dark', label: 'Dark', icon: 'moon-outline' },
          ].map((opt) => {
            const active = mode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.appearanceOption, active && styles.appearanceOptionActive]}
                activeOpacity={0.8}
                onPress={() => setMode(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={opt.icon} size={20} color={active ? '#fff' : COLORS.textSecondary} />
                <Text style={[styles.appearanceText, active && styles.appearanceTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.appearanceHint}>"System" follows your phone's light or dark setting.</Text>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <ToggleRow icon="notifications-off" iconColor={COLORS.error} label="Mute all" sub="Pause every push notification. They still appear in the app." value={muteAll} onChange={(v) => handleNotifToggle("muteAll", v, setMuteAll)} />
          <ToggleRow icon="chatbubble-ellipses" iconColor="#2563EB" label="Messages" sub="Get notified about new messages" value={notifMessages} onChange={(v) => handleNotifToggle("messages", v, setNotifMessages)} disabled={muteAll} />
          <ToggleRow icon="person-add" iconColor="#7C3AED" label="New Followers" sub="When someone follows you" value={notifFollowers} onChange={(v) => handleNotifToggle("followers", v, setNotifFollowers)} disabled={muteAll} />
          <ToggleRow icon="star" iconColor="#F59E0B" label="Reviews" sub="When you get a new rating or review" value={notifReviews} onChange={(v) => handleNotifToggle("reviews", v, setNotifReviews)} disabled={muteAll} />
          <ToggleRow icon="pricetags" iconColor="#16A34A" label="Listing updates" sub="When a listing is approved or needs changes" value={notifListings} onChange={(v) => handleNotifToggle("listings", v, setNotifListings)} disabled={muteAll} />
          <ToggleRow icon="search" iconColor="#0D9488" label="Search alerts" sub={'New items matching your "Notify me" searches'} value={notifAlerts} onChange={(v) => handleNotifToggle("alerts", v, setNotifAlerts)} disabled={muteAll} isLast />
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <SettingRow icon="document-text" iconColor="#0D9488" label="Terms and Conditions" onPress={() => navigation.navigate('Terms')} />
          <SettingRow icon="shield-checkmark" iconColor="#2563EB" label="Privacy Policy" sub="What we collect and how it's used" onPress={() => navigation.navigate('Privacy')} />
          <SettingRow icon="help-circle" iconColor="#EA580C" label="App Tour" sub="Replay the guided tours of GumaCart's features" onPress={() => { resetScreenTours().catch(() => {}); navigation.navigate("Main", { screen: "Home", params: { startTour: Date.now() } }); }} />
          <SettingRow icon="information-circle" iconColor="#16A34A" label="About GumaCart" sub="Our story and the team behind the app" onPress={() => navigation.navigate('About')} isLast />
        </View>

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteLink} activeOpacity={0.7} onPress={handleDeleteAccount}>
          <Text style={styles.deleteLinkText}>Delete account</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SLSU-GumaCart · Version {appVersion}</Text>
        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>

      <Sheet
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Profile"
        subtitle="How other students see you"
        icon="person"
        busy={savingProfile}
        action={{ title: "Save Changes", icon: "checkmark", onPress: handleSaveProfile, loading: savingProfile }}
      >
        <TouchableOpacity style={styles.photoWrap} activeOpacity={0.85} onPress={changePhoto} disabled={uploadingPhoto} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.photoRing}>
            {uploadingPhoto ? (
              <View style={[styles.photo, styles.photoFallback]}><ActivityIndicator color={COLORS.primary} /></View>
            ) : photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.photo} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.photoInitial}>{(name || user?.displayName || "?")[0].toUpperCase()}</Text>
              </View>
            )}
          </LinearGradient>
          <View style={styles.photoBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>{uploadingPhoto ? "Uploading..." : "Tap to change photo"}</Text>

        <SheetSection title="Personal info" />
        <FormField label="Name" icon="person-outline" value={name} onChangeText={setName} placeholder="Your full name" />
        <View style={styles.fieldRow}>
          <FormField style={{ flex: 2 }} label="Address" icon="location-outline" value={address} onChangeText={setAddress} placeholder="Your address" />
          <FormField style={{ flex: 1 }} label="Age" icon="calendar-outline" value={age} onChangeText={setAge} placeholder="Age" keyboardType="numeric" maxLength={3} />
        </View>

        <SheetSection title="School" />
        <AcademicFields
          course={course}
          onCourse={setCourse}
          yearLevel={yearLevel}
          onYearLevel={setYearLevel}
          showYear={!isFaculty}
          labelStyle={styles.inputLabel}
        />
      </Sheet>

      <Sheet
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
        subtitle="This cannot be undone"
        icon="trash"
        tone="danger"
        busy={deleting}
        action={{ title: "Delete Forever", icon: "trash-outline", onPress: handleConfirmDelete, loading: deleting, danger: true }}
      >
        <View style={styles.dangerNote}>
          <Ionicons name="warning" size={18} color={COLORS.error} />
          <Text style={styles.dangerNoteText}>
            This permanently deletes your account, listings, photos, reviews and follows. Conversations stay visible to the people you chatted with.
          </Text>
        </View>
        <FormField label="Password" icon="lock-closed-outline" secure value={deletePassword} onChangeText={setDeletePassword} placeholder="Enter your password to confirm" editable={!deleting} />
      </Sheet>

      <Sheet
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
        subtitle="Enter your current password to confirm it's you"
        icon="lock-closed"
        busy={changingPassword}
        action={{ title: "Update Password", icon: "checkmark", onPress: handleChangePassword, loading: changingPassword }}
      >
        <FormField label="Current Password" icon="lock-closed-outline" secure value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" />
        <FormField
          label="New Password" icon="key-outline" secure value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters"
          error={newPassword && newPassword.length < 6 ? "Must be at least 6 characters" : null}
        />
        <FormField
          label="Confirm New Password" icon="key-outline" secure value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password"
          error={confirmPassword && confirmPassword !== newPassword ? "Passwords don't match" : null}
        />
      </Sheet>
    </View>
  );
}

function SettingRow({ icon, label, sub, onPress, isLast, labelColor, iconColor, disabled }) {
  const { COLORS, styles } = useTheme(createStyles);
  return (
    <TouchableOpacity style={[styles.settingRow, !isLast && styles.settingRowBorder]} onPress={onPress} disabled={disabled} activeOpacity={0.7}>
      <View style={[styles.settingIconBox, iconColor && { backgroundColor: iconColor + "1A" }]}>
        <Ionicons name={icon} size={18} color={iconColor || COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, labelColor && { color: labelColor }]}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, sub, value, onChange, isLast, iconColor, disabled }) {
  const { COLORS, styles } = useTheme(createStyles);
  iconColor = iconColor || COLORS.primary;
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder, disabled && { opacity: 0.45 }]}>
      <View style={[styles.settingIconBox, { backgroundColor: iconColor + "1A" }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: COLORS.border, true: COLORS.primaryLighter }} thumbColor={value ? COLORS.primary : "#f4f3f4"} />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 28, height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.error, backgroundColor: COLORS.surface },
  logoutText: { fontSize: 15.5, fontWeight: "700", color: COLORS.error },
  deleteLink: { alignSelf: "center", paddingVertical: 14, paddingHorizontal: 12 },
  deleteLinkText: { fontSize: 13.5, color: COLORS.textMuted, textDecorationLine: "underline" },
  versionText: { textAlign: "center", fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  photoWrap: { alignSelf: "center", marginTop: 16 },
  photoRing: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  photo: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: COLORS.surface },
  photoFallback: { backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center" },
  photoInitial: { fontSize: 34, fontFamily: FONTS.heading, color: COLORS.primary },
  photoBadge: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.surface },
  photoHint: { textAlign: "center", fontSize: 12.5, color: COLORS.textMuted, marginTop: 6 },
  appearanceCard: { flexDirection: "row", padding: 6, gap: 6 },
  appearanceOption: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12, borderRadius: RADIUS.md },
  appearanceOptionActive: { backgroundColor: COLORS.primary },
  appearanceText: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary },
  appearanceTextActive: { color: "#fff" },
  appearanceHint: { fontSize: 12, color: COLORS.textMuted, marginHorizontal: 20, marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginHorizontal: 20, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: COLORS.surface, marginHorizontal: 16, borderRadius: 18, overflow: "hidden", ...SHADOWS.sm },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginRight: 13 },
  settingLabel: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  settingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  inputLabel: { fontSize: 13.5, fontWeight: "600", color: COLORS.textPrimary, marginTop: 14, marginBottom: 7 },
  fieldRow: { flexDirection: "row", gap: 10 },
  dangerNote: { flexDirection: "row", gap: 10, backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md, padding: 12, marginTop: 14 },
  dangerNoteText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.error },
});
