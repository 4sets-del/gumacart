import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, StatusBar, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Ellipse, Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = '#2E6B3E';
const BG = '#EAEDE8';
const W = Dimensions.get('window').width;

function CampusSilhouette() {
  const c = '#B8CCAF';
  return (
    <Svg width={W} height={110} viewBox="0 0 390 110" preserveAspectRatio="xMidYMid meet">
      {/* Sky fade / ground */}
      <Rect x="0" y="95" width="390" height="15" fill={c} opacity="0.35" />

      {/* Far left small trees */}
      <Ellipse cx="12" cy="72" rx="12" ry="18" fill={c} opacity="0.45" />
      <Rect x="9" y="86" width="5" height="9" fill={c} opacity="0.4" />
      <Ellipse cx="30" cy="66" rx="15" ry="24" fill={c} opacity="0.5" />
      <Rect x="27" y="85" width="6" height="10" fill={c} opacity="0.4" />

      {/* Left building */}
      <Rect x="50" y="58" width="50" height="37" fill={c} opacity="0.4" />
      <Rect x="60" y="50" width="30" height="12" fill={c} opacity="0.4" />
      <Rect x="56" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="72" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="88" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />

      {/* Center main building */}
      <Rect x="130" y="52" width="130" height="43" fill={c} opacity="0.45" />
      {/* Wings */}
      <Rect x="115" y="62" width="20" height="33" fill={c} opacity="0.4" />
      <Rect x="255" y="62" width="20" height="33" fill={c} opacity="0.4" />
      {/* Pediment / top story */}
      <Rect x="148" y="42" width="94" height="14" fill={c} opacity="0.45" />
      {/* Dome base */}
      <Rect x="178" y="28" width="34" height="16" fill={c} opacity="0.48" />
      {/* Dome */}
      <Path d="M178 28 Q195 8 212 28 Z" fill={c} opacity="0.52" />
      {/* Clock tower top */}
      <Rect x="190" y="4" width="10" height="14" fill={c} opacity="0.45" />
      <Circle cx="195" cy="22" r="5" fill={c} opacity="0.3" />
      {/* Center windows */}
      <Rect x="140" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="158" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="176" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="195" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="213" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="231" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="249" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />

      {/* Right building */}
      <Rect x="285" y="58" width="52" height="37" fill={c} opacity="0.4" />
      <Rect x="293" y="50" width="36" height="12" fill={c} opacity="0.4" />
      <Rect x="290" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="306" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="322" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />

      {/* Right trees */}
      <Ellipse cx="352" cy="66" rx="15" ry="24" fill={c} opacity="0.5" />
      <Rect x="348" y="85" width="6" height="10" fill={c} opacity="0.4" />
      <Ellipse cx="374" cy="72" rx="13" ry="20" fill={c} opacity="0.45" />
      <Rect x="371" y="87" width="5" height="8" fill={c} opacity="0.4" />
    </Svg>
  );
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');

  // Forgot-password flow
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const openReset = () => {
    setResetEmail(email.trim()); // pre-fill with whatever they typed
    setResetSent(false);
    setResetVisible(true);
  };

  const handleResetPassword = async () => {
    const target = resetEmail.trim();
    if (!target) {
      Alert.alert('Email required', 'Please enter the email address for your account.');
      return;
    }
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, target);
      setResetSent(true);
    } catch (e) {
      // Don't reveal whether an account exists — just report send problems generically
      let msg = 'Could not send the reset email. Please try again.';
      if (e.code === 'auth/invalid-email') msg = 'That email address looks invalid.';
      if (e.code === 'auth/too-many-requests') msg = 'Too many attempts. Please wait a moment and try again.';
      Alert.alert('Error', msg);
    } finally {
      setResetSending(false);
    }
  };
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      let message = 'Something went wrong. Please try again.';
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
        message = 'Incorrect email or password.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Try again later.';
      }
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <View style={styles.blobTopRight} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🛒</Text>
            </View>
            <Text style={styles.appName}>SLSU-GumaCart</Text>
            <Text style={styles.tagline}>Buy, Sell, and Exchange with{'\n'}SLSU Students</Text>
          </View>

          {/* Campus silhouette sits right below tagline */}
          <View style={styles.silhouetteWrap}>
            <CampusSilhouette />
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Email / Username</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email or username"
                placeholderTextColor="#B0BBA8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor="#B0BBA8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={GREEN} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7} onPress={openReset}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot password sheet */}
      <Modal
        visible={resetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetVisible(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableOpacity style={styles.resetOverlay} activeOpacity={1} onPress={() => setResetVisible(false)}>
          <TouchableOpacity style={styles.resetSheet} activeOpacity={1}>
            <View style={styles.resetHandle} />

            {!resetSent ? (
              <>
                <View style={styles.resetIconCircle}>
                  <Ionicons name="lock-open-outline" size={26} color={GREEN} />
                </View>
                <Text style={styles.resetTitle}>Reset your password</Text>
                <Text style={styles.resetSub}>
                  Enter the email you signed up with. We'll send you a link to create a new password.
                </Text>

                <View style={styles.resetInputWrap}>
                  <Ionicons name="mail-outline" size={19} color="#999" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.resetInput}
                    placeholder="your.email@example.com"
                    placeholderTextColor="#AAA"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.resetBtn, resetSending && { opacity: 0.7 }]}
                  activeOpacity={0.85}
                  onPress={handleResetPassword}
                  disabled={resetSending}
                >
                  {resetSending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.resetBtnText}>Send Reset Link</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resetCancel} activeOpacity={0.7} onPress={() => setResetVisible(false)}>
                  <Text style={styles.resetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.resetIconCircle, { backgroundColor: '#E8F5EC' }]}>
                  <Ionicons name="mail-open-outline" size={26} color={GREEN} />
                </View>
                <Text style={styles.resetTitle}>Check your email</Text>
                <Text style={styles.resetSub}>
                  If an account exists for {resetEmail.trim()}, a password reset link has been sent.
                </Text>
                <View style={styles.resetSpamNote}>
                  <Ionicons name="alert-circle-outline" size={15} color="#e67e22" style={{ marginRight: 8 }} />
                  <Text style={styles.resetSpamText}>
                    Can't find it? Check your Spam or Junk folder.
                  </Text>
                </View>
                <TouchableOpacity style={styles.resetBtn} activeOpacity={0.85} onPress={() => setResetVisible(false)}>
                  <Text style={styles.resetBtnText}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, paddingTop: STATUSBAR_TOP },
  blobTopRight: {
    position: 'absolute', top: -60, right: -100,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#C8D9C0', opacity: 0.6,
  },
  container: { flexGrow: 1 },
  logoSection: { alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 28 },
  logoCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#D6E8D0', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 52 },
  appName: { fontSize: 30, fontWeight: '800', color: GREEN, marginBottom: 8, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  silhouetteWrap: { marginTop: 4, marginBottom: 0 },
  form: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 48 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 8, marginTop: 16 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#D0DBD0',
    paddingHorizontal: 16, height: 58,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#333' },
  loginBtn: {
    backgroundColor: GREEN, borderRadius: 14, height: 58,
    alignItems: 'center', justifyContent: 'center', marginTop: 28, elevation: 2,
  },
  loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  signupText: { fontSize: 14, color: '#666' },
  signupLink: { fontSize: 14, color: GREEN, fontWeight: '700' },

  // Forgot password
  forgotBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  forgotText: { fontSize: 14, color: GREEN, fontWeight: '600' },
  resetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  resetSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 30, alignItems: 'center' },
  resetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', marginBottom: 18 },
  resetIconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  resetTitle: { fontSize: 19, fontWeight: '800', color: '#111', marginBottom: 6 },
  resetSub: { fontSize: 13.5, color: '#777', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  resetInputWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: '#E4E9E0', backgroundColor: '#FAFBF9', paddingHorizontal: 14, marginBottom: 16 },
  resetInput: { flex: 1, fontSize: 15, color: '#111' },
  resetBtn: { width: '100%', height: 52, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 15.5, fontWeight: '800', color: '#fff' },
  resetCancel: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  resetCancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  resetSpamNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF5E7', borderRadius: 12, padding: 12, marginBottom: 20, width: '100%' },
  resetSpamText: { flex: 1, fontSize: 12.5, color: '#8a5a20', lineHeight: 18 },
});
