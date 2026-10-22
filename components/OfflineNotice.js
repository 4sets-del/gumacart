import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Small pill at the top of the screen while the phone is offline. It doesn't
// block the app, so people can keep browsing saved listings and photos.
// Short signal drops (under 2s) are ignored to avoid flicker on weak Wi-Fi.
const SHOW_DELAY_MS = 2000;
const BACK_ONLINE_MS = 2000;

export default function OfflineNotice() {
  const { styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('online'); // 'online' | 'offline' | 'back'
  const [slide] = useState(() => new Animated.Value(0));
  const timers = useRef({});

  useEffect(() => {
    const t = timers.current;
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Offline when not connected OR connected but with no real internet.
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      clearTimeout(t.show);
      clearTimeout(t.hide);
      if (offline) {
        t.show = setTimeout(() => setStatus('offline'), SHOW_DELAY_MS);
      } else {
        setStatus((prev) => {
          if (prev !== 'offline') return 'online';
          t.hide = setTimeout(() => setStatus('online'), BACK_ONLINE_MS);
          return 'back';
        });
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(t.show);
      clearTimeout(t.hide);
    };
  }, []);

  useEffect(() => {
    Animated.spring(slide, { toValue: status === 'online' ? 0 : 1, useNativeDriver: true, friction: 8 }).start();
  }, [status, slide]);

  const back = status === 'back';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.pill,
        back && styles.pillBack,
        {
          top: insets.top + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
        },
      ]}
    >
      <Ionicons name={back ? 'wifi' : 'cloud-offline'} size={15} color="#fff" />
      <Text style={styles.text}>{back ? 'Back online' : "You're offline · showing saved items"}</Text>
    </Animated.View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  pill: {
    position: 'absolute', alignSelf: 'center', zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#3A3F3B', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  pillBack: { backgroundColor: COLORS.primary },
  text: { color: '#fff', fontSize: 13, fontFamily: FONTS.headingSemi },
});
