import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import GradientButton from '../components/GradientButton';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Campus photo is 1086x1448; fill the screen and anchor the bottom so the
// building and SLSU sign stay in view on any phone size.
const PHOTO_H = Math.max(SCREEN_H, Math.round(SCREEN_W * (1448 / 1086)));

export default function WelcomeScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar} />

      <Image source={require('../assets/slsu-campus.jpg')} style={styles.photo} resizeMode="cover" />

      {/* Fade at the top (white, or dark in dark mode) so the logo and text read clearly */}
      <LinearGradient
        colors={[COLORS.surface, `${COLORS.surface}F0`, `${COLORS.surface}00`]}
        locations={[0, 0.45, 1]}
        style={[styles.topFade, { height: SCREEN_H * 0.58 }]}
      />
      {/* Dark fade at the bottom behind the buttons */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
        style={[styles.bottomFade, { height: SCREEN_H * 0.32 }]}
      />

      <View style={[styles.brand, { paddingTop: insets.top + 44 }]}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>SLSU-GumaCart</Text>
        <Text style={styles.subtitle}>Buy  •  Sell  •  Exchange</Text>
        <Text style={styles.tagline}>Your Campus Marketplace{'\n'}for Students, by Students.</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <GradientButton title="Get Started" icon="arrow-forward" onPress={() => navigation.navigate('Signup')} height={54} />
        <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkBtnText}>Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  photo: { position: 'absolute', left: 0, right: 0, bottom: 0, width: SCREEN_W, height: PHOTO_H },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  brand: { alignItems: 'center', paddingHorizontal: 28 },
  logo: { width: 84, height: 84, borderRadius: 22, marginBottom: 18 },
  title: { fontSize: 32, fontFamily: FONTS.heading, color: COLORS.primaryDark, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginTop: 6 },
  tagline: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 18 },

  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, gap: 6 },
  linkBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
