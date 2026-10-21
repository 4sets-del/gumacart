import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, { Path, Rect, Ellipse } from 'react-native-svg';
import { FONTS } from '../constants/theme';

const GREEN = '#2E6B3E';
const W = Dimensions.get('window').width;

function CampusSilhouette() {
  const c = 'rgba(255,255,255,0.12)';
  return (
    <Svg width={W} height={110} viewBox="0 0 390 110" preserveAspectRatio="xMidYMid meet">
      <Rect x="0" y="95" width="390" height="15" fill={c} />
      <Ellipse cx="30" cy="66" rx="15" ry="24" fill={c} />
      <Rect x="27" y="85" width="6" height="10" fill={c} />
      <Rect x="50" y="58" width="50" height="37" fill={c} />
      <Rect x="60" y="50" width="30" height="12" fill={c} />
      <Rect x="130" y="52" width="130" height="43" fill={c} />
      <Rect x="115" y="62" width="20" height="33" fill={c} />
      <Rect x="255" y="62" width="20" height="33" fill={c} />
      <Rect x="148" y="42" width="94" height="14" fill={c} />
      <Rect x="178" y="28" width="34" height="16" fill={c} />
      <Path d="M178 28 Q195 8 212 28 Z" fill={c} />
      <Rect x="190" y="4" width="10" height="14" fill={c} />
      <Rect x="285" y="58" width="52" height="37" fill={c} />
      <Rect x="293" y="50" width="36" height="12" fill={c} />
      <Ellipse cx="352" cy="66" rx="15" ry="24" fill={c} />
      <Rect x="348" y="85" width="6" height="10" fill={c} />
    </Svg>
  );
}

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.center}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center' }}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🛒</Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
          <Text style={styles.appName}>SLSU-GumaCart</Text>
          <Text style={styles.tagline}>Campus Marketplace</Text>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>

      <View style={styles.silhouette} pointerEvents="none">
        <CampusSilhouette />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREEN },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  logoIcon: { fontSize: 60 },
  appName: { fontSize: 32, fontFamily: FONTS.heading, color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  bottom: { position: 'absolute', bottom: 140, left: 0, right: 0, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  silhouette: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
