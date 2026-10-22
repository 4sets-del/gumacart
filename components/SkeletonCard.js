import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Grey placeholder shaped like a ProductCard, gently pulsing while
// listings load, so the screen never shows a misleading "no listings".
export default function SkeletonCard({ width }) {
  const { styles } = useTheme(createStyles);
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { width, opacity: pulse }]}>
      <View style={styles.image} />
      <View style={styles.body}>
        <View style={[styles.line, { width: '80%' }]} />
        <View style={[styles.line, { width: '45%', height: 12 }]} />
      </View>
    </Animated.View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  image: { width: '100%', aspectRatio: 1.1, backgroundColor: COLORS.surfaceAlt },
  body: { padding: 10, gap: 8 },
  line: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceAlt },
});
