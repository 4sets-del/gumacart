import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/theme';
import GradientButton from '../components/GradientButton';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.brand}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>SLSU-GumaCart</Text>
        <Text style={styles.subtitle}>Buy  •  Sell  •  Exchange</Text>
        <Text style={styles.tagline}>Your Campus Marketplace{'\n'}for Students, by Students.</Text>
      </View>

      {/* Decorative scene standing in for a campus photo */}
      <View style={styles.scene}>
        <View style={[styles.bubble, styles.bubbleLarge]} />
        <View style={[styles.bubble, styles.bubbleSmall]} />
        <View style={styles.iconRow}>
          {['book', 'shirt', 'laptop', 'fast-food'].map((name) => (
            <View key={name} style={styles.iconTile}>
              <Ionicons name={name} size={26} color={COLORS.primary} />
            </View>
          ))}
        </View>
        <View style={styles.schoolBadge}>
          <Ionicons name="school" size={18} color={COLORS.white} />
          <Text style={styles.schoolText}>Southern Luzon State University</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <GradientButton title="Get Started" icon="arrow-forward" onPress={() => navigation.navigate('Signup')} height={54} />
        <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkBtnText}>Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 28, justifyContent: 'space-between' },

  brand: { alignItems: 'center' },
  logo: { width: 84, height: 84, borderRadius: 22, marginBottom: 18 },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '600', color: COLORS.primary, marginTop: 6 },
  tagline: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 22 },

  scene: { height: 220, borderRadius: 28, backgroundColor: COLORS.primaryPale, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: COLORS.primaryLighter, opacity: 0.45 },
  bubbleLarge: { width: 220, height: 220, top: -90, right: -60 },
  bubbleSmall: { width: 140, height: 140, bottom: -60, left: -40 },
  iconRow: { flexDirection: 'row', gap: 14 },
  iconTile: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  schoolBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  schoolText: { color: COLORS.white, fontWeight: '700', fontSize: 12.5 },

  actions: { gap: 6 },
  primaryBtn: { height: 54, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  linkBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
});
