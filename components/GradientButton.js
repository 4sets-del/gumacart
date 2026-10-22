import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GRADIENTS, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Main call-to-action button with a left-to-right gradient fill.
// `loadingText` (optional) is shown next to the spinner, e.g. upload progress.
export default function GradientButton({ title, onPress, loading, loadingText, disabled, icon, colors = GRADIENTS.primary, style, height = 52 }) {
  const { styles } = useTheme(createStyles);
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.shadow, { shadowColor: colors[0] }, (disabled || loading) && { opacity: 0.7 }, style]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, { height }]}>
        {loading ? (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" />
            {loadingText ? <Text style={styles.text}>{loadingText}</Text> : null}
          </View>
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={19} color="#fff" /> : null}
            <Text style={styles.text}>{title}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  shadow: { borderRadius: RADIUS.md, elevation: 3, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fill: { borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
