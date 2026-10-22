import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions,
} from 'react-native';
import { Alert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { RADIUS, FONTS } from '../constants/theme';
import Sheet, { FormField } from "../components/Sheet";
import { useTheme } from '../context/ThemeContext';
import GradientButton from '../components/GradientButton';
import StatusBarScrim from '../components/StatusBarScrim';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(SCREEN_H * 0.44);
// Campus photo is 1086x1448; anchor its bottom so the building and SLSU sign show.
const PHOTO_HEIGHT = Math.round(SCREEN_W * (1448 / 1086));

export default function LoginScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
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
    <View style={styles.safe}>
      <StatusBarScrim />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Campus photo */}
          <View style={styles.hero}>
            <Image source={require('../assets/slsu-campus.jpg')} style={styles.heroImage} resizeMode="cover" />
            {navigation.canGoBack() && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
                style={[styles.backBtn, { top: insets.top + 8 }]}
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.tagline}>Log in to buy, sell, and exchange with fellow SLSU students.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="yourname@slsu.edu.ph"
                placeholderTextColor={COLORS.textMuted}
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
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7} onPress={openReset}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <GradientButton title="Login" icon="log-in-outline" onPress={handleLogin} loading={loading} style={{ marginTop: 20 }} />

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot password sheet */}
      <Sheet
        visible={resetVisible}
        onClose={() => setResetVisible(false)}
        title={resetSent ? "Check your email" : "Reset your password"}
        subtitle={resetSent
          ? `If an account exists for ${resetEmail.trim()}, a reset link has been sent.`
          : "We'll email you a link to create a new password."}
        icon={resetSent ? "mail-open" : "lock-open"}
        busy={resetSending}
        action={resetSent
          ? null
          : { title: "Send Reset Link", icon: "send", onPress: handleResetPassword, loading: resetSending }}
        footer={resetSent ? (
          <View style={styles.resetFooter}>
            <GradientButton title="Back to Login" icon="arrow-back" onPress={() => setResetVisible(false)} />
          </View>
        ) : undefined}
      >
        {resetSent ? (
          <View style={styles.resetSpamNote}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
            <Text style={styles.resetSpamText}>Can't find it? Check your Spam or Junk folder.</Text>
          </View>
        ) : (
          <FormField
            label="SLSU Email"
            icon="mail-outline"
            placeholder="yourname@slsu.edu.ph"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      </Sheet>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  hero: { height: HERO_HEIGHT, backgroundColor: COLORS.primaryPale, overflow: 'hidden' },
  heroImage: { position: 'absolute', left: 0, right: 0, bottom: 0, width: SCREEN_W, height: Math.max(PHOTO_HEIGHT, HERO_HEIGHT) },
  backBtn: { position: 'absolute', left: 16, zIndex: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, marginTop: -24, backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 32 },
  logoSection: { alignItems: 'center', paddingTop: 22, paddingBottom: 4 },
  logo: { width: 60, height: 60, borderRadius: 16, marginBottom: 14 },
  title: { fontSize: 26, fontFamily: FONTS.heading, color: COLORS.primaryDark, letterSpacing: -0.5 },
  tagline: { fontSize: 14.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 8, maxWidth: 290 },
  form: { paddingTop: 12 },
  fieldLabel: { fontSize: 13.5, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8, marginTop: 16 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  signupText: { fontSize: 14, color: COLORS.textSecondary },
  signupLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  // Forgot password
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 10, paddingLeft: 8 },
  forgotText: { fontSize: 13.5, color: COLORS.primary, fontWeight: '600' },
  resetSpamNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 12, marginTop: 14 },
  resetFooter: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  resetSpamText: { flex: 1, fontSize: 13, color: COLORS.warning },
});
