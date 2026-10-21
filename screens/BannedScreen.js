import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signOutUser } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, FONTS } from '../constants/theme';

const RED = COLORS.error;
const BG = COLORS.white;
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

function formatRemaining(ms) {
  if (ms <= 0) return 'any moment now';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || (!days && !hours)) parts.push(`${mins}m`);
  return parts.join(' ');
}

export default function BannedScreen() {
  const { user, userProfile } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingAppeal, setExistingAppeal] = useState(null);
  const [now, setNow] = useState(Date.now());

  const until = userProfile?.bannedUntil;
  const untilDate = until ? (until?.toDate ? until.toDate() : new Date(until)) : null;
  const isTemporary = !!untilDate;
  const remainingMs = untilDate ? untilDate.getTime() - now : 0;

  useEffect(() => {
    if (!isTemporary) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [isTemporary]);

  useEffect(() => {
    const checkAppeal = async () => {
      if (!user?.uid) { setLoading(false); return; }
      try {
        const q = query(
          collection(db, 'appeals'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) setExistingAppeal({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } catch (e) {
        try {
          const q2 = query(collection(db, 'appeals'), where('userId', '==', user.uid));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) setExistingAppeal({ id: snap2.docs[0].id, ...snap2.docs[0].data() });
        } catch (e2) {}
      } finally { setLoading(false); }
    };
    checkAppeal();
  }, [user]);

  const submitAppeal = async () => {
    if (reason.trim().length < 10) {
      Alert.alert('Please explain', 'Add a bit more detail so an admin can review your appeal.');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'appeals'), {
        userId: user.uid,
        userName: userProfile?.name || auth.currentUser?.displayName || 'User',
        userEmail: userProfile?.email || auth.currentUser?.email || '',
        message: reason.trim(),
        banReason: userProfile?.banReason || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setExistingAppeal({ status: 'pending', message: reason.trim() });
      Alert.alert('Appeal submitted', 'An admin will review your appeal. You will regain access if it is approved.');
    } catch (e) {
      Alert.alert('Error', 'Could not submit your appeal. Please try again later.');
    } finally { setSubmitting(false); }
  };

  const handleSignOut = () => signOutUser().catch(() => {});

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={RED} size="large" />
      </SafeAreaView>
    );
  }

  const pending = existingAppeal?.status === 'pending';
  const rejected = existingAppeal?.status === 'rejected';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Ionicons name="ban" size={44} color={RED} />
          </View>

          <Text style={styles.title}>Account Suspended</Text>
          <Text style={styles.subtitle}>
            {isTemporary
              ? 'Your account has been temporarily suspended by an administrator.'
              : 'Your account has been suspended by an administrator and you can’t use SLSU-GumaCart right now.'}
          </Text>

          {userProfile?.banReason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonValue}>{userProfile.banReason}</Text>
            </View>
          ) : null}

          {isTemporary && (
            <View style={styles.timerBox}>
              <Ionicons name="time-outline" size={22} color="#B9770E" style={{ marginBottom: 6 }} />
              <Text style={styles.timerTitle}>Time remaining</Text>
              <Text style={styles.timerValue}>{formatRemaining(remainingMs)}</Text>
              <Text style={styles.timerSub}>
                Access returns on {untilDate.toLocaleDateString()} at {untilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.timerHint}>Reopen the app after this time to get back in.</Text>
            </View>
          )}

          {pending ? (
            <View style={styles.statusBox}>
              <Ionicons name="time-outline" size={20} color="#B9770E" style={{ marginBottom: 6 }} />
              <Text style={styles.statusTitle}>Appeal under review</Text>
              <Text style={styles.statusText}>
                You’ve submitted an appeal. An admin will review it and your access will be restored if it’s approved.
              </Text>
              {existingAppeal?.message ? (
                <Text style={styles.appealEcho}>“{existingAppeal.message}”</Text>
              ) : null}
            </View>
          ) : (
            <>
              {rejected && (
                <View style={[styles.statusBox, { backgroundColor: COLORS.errorLight }]}>
                  <Text style={styles.statusTitle}>Previous appeal declined</Text>
                  <Text style={styles.statusText}>You may submit another appeal with more detail below.</Text>
                </View>
              )}
              <Text style={styles.label}>Appeal to an admin</Text>
              <TextInput
                style={styles.input}
                placeholder="Explain why your account should be restored…"
                placeholderTextColor={COLORS.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
                textAlignVertical="top"
                maxLength={600}
              />
              <Text style={styles.counter}>{reason.length}/600</Text>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={submitAppeal}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Appeal</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, paddingTop: STATUSBAR_TOP },
  container: { flexGrow: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 10, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  reasonBox: { width: '100%', backgroundColor: COLORS.errorLight, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16 },
  reasonLabel: { fontSize: 11, fontFamily: FONTS.heading, color: RED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  reasonValue: { fontSize: 14.5, color: COLORS.textPrimary, lineHeight: 20, fontWeight: '600' },
  timerBox: { width: '100%', backgroundColor: COLORS.warningLight, borderRadius: RADIUS.lg, padding: 16, marginBottom: 22, alignItems: 'center' },
  timerTitle: { fontSize: 12, fontFamily: FONTS.heading, color: '#B9770E', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerValue: { fontSize: 26, fontFamily: FONTS.heading, color: '#8A5A0B', marginVertical: 4 },
  timerSub: { fontSize: 12.5, color: '#8A5A0B', textAlign: 'center' },
  timerHint: { fontSize: 12, color: '#A9863F', textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
  label: { alignSelf: 'flex-start', fontSize: 13.5, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  input: { width: '100%', minHeight: 120, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 14, fontSize: 15, color: COLORS.textPrimary },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: COLORS.textMuted, marginTop: 6, marginBottom: 16 },
  submitBtn: { width: '100%', height: 52, borderRadius: RADIUS.md, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusBox: { width: '100%', backgroundColor: COLORS.warningLight, borderRadius: RADIUS.lg, padding: 16, marginBottom: 24, alignItems: 'center' },
  statusTitle: { fontSize: 15, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 4 },
  statusText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  appealEcho: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 30, padding: 10 },
  signOutText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
});
