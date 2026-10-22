import React, { useState } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { signOutUser } from '../utils/auth';
import { SCHOOL_DOMAIN } from '../constants/school';
import { RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import GradientButton from '../components/GradientButton';

// Shown to accounts that don't use an SLSU email (older accounts made before
// the rule). They can only log out and sign up again with their school email.
export default function SchoolEmailRequiredScreen() {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const logOut = async () => {
    setLeaving(true);
    try { await signOutUser(); } catch (e) { setLeaving(false); }
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle={COLORS.statusBar} />
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="school" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>SLSU email required</Text>
        <Text style={styles.text}>
          GumaCart is only for the SLSU community, so every account must use an institutional email ending in
          <Text style={styles.bold}> @{SCHOOL_DOMAIN}</Text>.
        </Text>
        <View style={styles.emailBox}>
          <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          <Ionicons name="close-circle" size={18} color={COLORS.error} />
        </View>
        <Text style={styles.hint}>Log out, then create a new account with your SLSU email.</Text>
      </View>
      <GradientButton title="Log out" icon="log-out-outline" onPress={logOut} loading={leaving} style={styles.button} />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary, textAlign: 'center' },
  text: { fontSize: 14.5, lineHeight: 21, color: COLORS.textSecondary, textAlign: 'center', marginTop: 10 },
  bold: { fontWeight: '700', color: COLORS.textPrimary },
  emailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 22,
    backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 50,
  },
  email: { flex: 1, fontSize: 14.5, color: COLORS.textPrimary },
  hint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 14 },
  button: { alignSelf: 'stretch' },
});
