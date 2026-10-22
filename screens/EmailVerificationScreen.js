import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
  AppState, Platform, Linking,} from 'react-native';
import { Alert } from '../components/AppAlert';
import * as IntentLauncher from 'expo-intent-launcher';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { sendEmailVerification, reload } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { signOutUser } from '../utils/auth';
import { RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;


export default function EmailVerificationScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const user = auth.currentUser;
  const appState = useRef(AppState.currentState);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const checkVerified = async (silent = false) => {
    if (!user) return;
    if (!silent) setChecking(true);
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        // AuthContext / AppNavigator will pick this up automatically and route to App
      } else if (!silent) {
        Alert.alert('Not Verified Yet', 'Please click the verification link in your email first.');
      }
    } catch (e) {
      console.log('Verification check error:', e.message);
    } finally {
      if (!silent) setChecking(false);
    }
  };

  // Auto-check verification status every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkVerified(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Also check when app comes back to foreground (user returns from email app)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkVerified(true);
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      Alert.alert('Email Sent', 'A new verification link has been sent to your email.');
      setCooldown(45);
    } catch (e) {
      if (e.code === 'auth/too-many-requests') {
        Alert.alert('Please wait', 'Too many attempts. Try again in a bit.');
        setCooldown(45);
      } else {
        Alert.alert('Error', 'Could not resend verification email.');
      }
    } finally {
      setResending(false);
    }
  };

  // Opens the phone's email app (inbox), so the user can tap the link without
  // hunting for the app. Falls back to Gmail on the web.
  const openEmailApp = async () => {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
          category: 'android.intent.category.APP_EMAIL',
          flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
        });
      } else {
        await Linking.openURL('message://');
      }
    } catch (e) {
      Linking.openURL('https://mail.google.com').catch(() => {
        Alert.alert('No email app found', 'Open your email app and look for the message from SLSU-GumaCart.');
      });
    }
  };

  const handleUseDifferentEmail = () => {
    Alert.alert('Use a different email?', 'This will sign you out so you can sign up again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOutUser() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle={COLORS.statusBar} />

      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={56} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to
        </Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Text style={styles.instructions}>
          Open the email and tap the verification link. This screen will automatically continue once you're verified.
        </Text>

        <View style={styles.spamNote}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} style={{ marginRight: 8 }} />
          <Text style={styles.spamNoteText}>
            Can't find it? Check your <Text style={{ fontFamily: FONTS.heading }}>Spam</Text> or <Text style={{ fontFamily: FONTS.heading }}>Junk</Text> folder. If it's there, tap <Text style={{ fontFamily: FONTS.heading }}>"Not Spam"</Text> so future emails reach your inbox.
          </Text>
        </View>

        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.statusText}>Waiting for verification...</Text>
        </View>

        <TouchableOpacity style={styles.openMailBtn} activeOpacity={0.85} onPress={openEmailApp}>
          <Ionicons name="mail-open-outline" size={19} color="#fff" />
          <Text style={styles.checkBtnText}>Open Email App</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.checkBtn, checking && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={() => checkVerified(false)}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.checkBtnText}>I've Verified My Email</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendBtn}
          activeOpacity={0.7}
          onPress={handleResend}
          disabled={resending || cooldown > 0}
        >
          <Text style={[styles.resendText, (resending || cooldown > 0) && { opacity: 0.5 }]}>
            {cooldown > 0 ? `Resend email in ${cooldown}s` : resending ? 'Sending...' : "Didn't get it? Resend email"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleUseDifferentEmail} activeOpacity={0.7} style={{ marginTop: 18 }}>
          <Text style={styles.differentEmailText}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface, paddingTop: STATUSBAR_TOP },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  iconCircle: { width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  email: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 4, marginBottom: 16 },
  instructions: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  spamNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: 13, marginBottom: 24 },
  spamNoteText: { flex: 1, fontSize: 12.5, color: COLORS.warning, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  statusText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  openMailBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#2563EB', borderRadius: RADIUS.md, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  checkBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center' },
  checkBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: 18, paddingVertical: 6 },
  resendText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  differentEmailText: { fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'underline' },
});
