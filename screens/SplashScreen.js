import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { FONTS } from '../constants/theme';

// Shown while the session loads, right after the native splash screen
// (assets/splash.png), so it uses the same light look: corner waves, the
// cart logo, the app name and the tagline.
const BG = '#F4F9F5';
const DEEP = '#14532B';
const LIGHT_WAVE = 'rgba(140,199,156,0.7)';
const { width: W, height: H } = Dimensions.get('window');

function Waves() {
  // Drawn on a 1284 x 2778 canvas (same as splash.png) and stretched to fit.
  return (
    <Svg width={W} height={H} viewBox="0 0 1284 2778" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="wave" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={DEEP} />
          <Stop offset="1" stopColor="#2E9A5A" />
        </LinearGradient>
      </Defs>
      <Path d="M620 0 H760 C640 170 420 260 0 420 V330 C330 210 520 120 620 0 Z" fill={LIGHT_WAVE} />
      <Path d="M0 0 H620 C520 120 330 210 0 330 Z" fill="url(#wave)" />
      <Path d="M560 2778 H420 C560 2560 880 2440 1284 2360 V2440 C960 2520 700 2620 560 2778 Z" fill={LIGHT_WAVE} />
      <Path d="M1284 2778 H560 C700 2620 960 2520 1284 2440 Z" fill="url(#wave)" />
    </Svg>
  );
}

export default function SplashScreen() {
  const [logoScale] = useState(() => new Animated.Value(0.85));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [textOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [logoScale, logoOpacity, textOpacity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Waves />

      <View style={styles.center}>
        <Animated.Image
          source={require('../assets/logo.png')}
          style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
          <Text style={styles.appName}>SLSU-GumaCart</Text>
          <Text style={styles.tagline}>Buy  •  Sell  •  Exchange  •  Donate</Text>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <ActivityIndicator size="small" color={DEEP} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 190, height: 190, marginBottom: 10 },
  appName: { fontSize: 30, fontFamily: FONTS.heading, color: DEEP, letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 15, color: '#59645C', fontWeight: '500' },
  bottom: { position: 'absolute', bottom: 190, left: 0, right: 0, alignItems: 'center' },
});
