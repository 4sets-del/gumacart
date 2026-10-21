import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  updateProfile, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, deleteUser,
} from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { signOutUser } from "../utils/auth";
import { useAuth } from "../context/AuthContext";
import { Image } from "expo-image";
import Constants from "expo-constants";
import { unregisterPushToken } from "../utils/notifications";
import WelcomeTutorial from "../components/WelcomeTutorial";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, RADIUS, SHADOWS, FONTS } from "../constants/theme";

const GREEN = COLORS.primary;

export default function SettingsScreen({ navigation }) {
  const user = auth.currentUser;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
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

  const [verificationStatus, setVerificationStatus] = useState(null);
  const { userProfile } = useAuth();
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  useEffect(() => {
    const loadVerificationStatus = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setVerificationStatus(userDoc.data()?.verificationStatus || null);
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
      setNotifMessages(data?.notifPrefs?.messages !== false);
      setNotifFollowers(data?.notifPrefs?.followers !== false);
      setNotifReviews(data?.notifPrefs?.reviews !== false);
    } catch (e) {}
  };

  const openEditModal = async () => { await loadProfileIntoForm(); setShowEditModal(true); };

  const handleSaveProfile = async () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter your name."); return; }
    setSavingProfile(true);
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(), address: address.trim(), age: age ? Number(age) : null,
      });
      Alert.alert("✅ Updated", "Your profile has been saved.");
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
      Alert.alert("✅ Password Changed", "Your password has been updated.");
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
      <WelcomeTutorial visible={showTutorial} onClose={() => setShowTutorial(false)} />

      <ScreenHeader
        title="Settings"
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Profile" }); }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Who is signed in */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.85} onPress={openEditModal}>
          {userProfile?.photoURL ? (
            <Image source={{ uri: userProfile.photoURL }} style={styles.profileAvatar} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
              <Text style={styles.profileAvatarText}>{(user?.displayName || "?")[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.displayName || "Student"}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
            {verificationStatus === "verified" && (
              <View style={styles.profileBadge}>
                <Ionicons name="checkmark-circle" size={12} color={GREEN} />
                <Text style={styles.profileBadgeText}>Verified SLSU Student</Text>
              </View>
            )}
          </View>
          <Ionicons name="create-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <SettingRow icon="person" iconColor="#2563EB" label="Edit Profile" sub="Name, address, age" onPress={openEditModal} />
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

        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <ToggleRow icon="chatbubble-ellipses" iconColor="#2563EB" label="Messages" sub="Get notified about new messages" value={notifMessages} onChange={(v) => handleNotifToggle("messages", v, setNotifMessages)} />
          <ToggleRow icon="person-add" iconColor="#7C3AED" label="New Followers" sub="When someone follows you" value={notifFollowers} onChange={(v) => handleNotifToggle("followers", v, setNotifFollowers)} />
          <ToggleRow icon="star" iconColor="#F59E0B" label="Reviews" sub="When you get a new rating or review" value={notifReviews} onChange={(v) => handleNotifToggle("reviews", v, setNotifReviews)} isLast />
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <SettingRow icon="document-text" iconColor="#0D9488" label="Terms and Conditions" onPress={() => navigation.navigate('Terms')} />
          <SettingRow icon="help-circle" iconColor="#EA580C" label="How GumaCart Works" sub="Replay the welcome tutorial" onPress={() => setShowTutorial(true)} />
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
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEditModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={COLORS.textMuted} />
            </View>

            <Text style={styles.inputLabel}>Address</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Your address" placeholderTextColor={COLORS.textMuted} />
            </View>

            <Text style={styles.inputLabel}>Age</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Your age" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" maxLength={3} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => !deleting && setShowDeleteModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => !deleting && setShowDeleteModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: COLORS.error }]}>Delete Account</Text>
            <Text style={styles.modalSubtitle}>
              This permanently deletes your account, listings, photos, reviews and follows. Conversations stay visible to the people you chatted with. This cannot be undone.
            </Text>

            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={deletePassword} onChangeText={setDeletePassword} placeholder="Enter your password" placeholderTextColor={COLORS.textMuted} secureTextEntry editable={!deleting} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)} disabled={deleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.error }, deleting && { opacity: 0.7 }]} onPress={handleConfirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Delete Forever</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPasswordModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSubtitle}>Enter your current password to confirm it's you</Text>

            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
            </View>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" placeholderTextColor={COLORS.textMuted} secureTextEntry />
            </View>

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPasswordModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, changingPassword && { opacity: 0.7 }]} onPress={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SettingRow({ icon, label, sub, onPress, isLast, labelColor, iconColor, disabled }) {
  return (
    <TouchableOpacity style={[styles.settingRow, !isLast && styles.settingRowBorder]} onPress={onPress} disabled={disabled} activeOpacity={0.7}>
      <View style={[styles.settingIconBox, iconColor && { backgroundColor: iconColor + "1A" }]}>
        <Ionicons name={icon} size={18} color={iconColor || GREEN} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, labelColor && { color: labelColor }]}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, sub, value, onChange, isLast, iconColor = GREEN }) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder]}>
      <View style={[styles.settingIconBox, { backgroundColor: iconColor + "1A" }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: COLORS.border, true: COLORS.primaryLighter }} thumbColor={value ? GREEN : "#f4f3f4"} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 16, marginTop: 12, backgroundColor: COLORS.white, borderRadius: 18, padding: 16, ...SHADOWS.sm },
  profileAvatar: { width: 58, height: 58, borderRadius: 29 },
  profileAvatarFallback: { backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 24, fontFamily: FONTS.heading, color: GREEN },
  profileName: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  profileEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  profileBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  profileBadgeText: { fontSize: 11, fontWeight: "700", color: GREEN },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 28, height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.error, backgroundColor: COLORS.white },
  logoutText: { fontSize: 15.5, fontWeight: "700", color: COLORS.error },
  deleteLink: { alignSelf: "center", paddingVertical: 14, paddingHorizontal: 12 },
  deleteLinkText: { fontSize: 13.5, color: COLORS.textMuted, textDecorationLine: "underline" },
  versionText: { textAlign: "center", fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginHorizontal: 20, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: COLORS.white, marginHorizontal: 16, borderRadius: 18, overflow: "hidden", ...SHADOWS.sm },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginRight: 13 },
  settingLabel: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  settingSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },
  inputLabel: { fontSize: 13.5, fontWeight: "600", color: COLORS.textPrimary, marginTop: 14, marginBottom: 7 },
  inputWrapper: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52, justifyContent: "center" },
  input: { fontSize: 15, color: COLORS.textPrimary },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 26 },
  cancelBtn: { flex: 1, height: 52, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: "700" },
  saveBtn: { flex: 2, height: 52, borderRadius: RADIUS.md, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 15, color: "#fff", fontWeight: "700" },
});
