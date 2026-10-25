import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SPACING, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// White top bar used across screens: back arrow, bold title, optional
// subtitle and right-side element. Handles the status bar inset itself.
export default function ScreenHeader({ title, subtitle, onBack, right, border = false }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }, border && styles.border]}>
      <StatusBar barStyle={COLORS.statusBar} />
      {onBack ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: SPACING.sm }} />
      )}
      <View style={styles.titleBox}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right || <View style={styles.iconBtn} />}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm, backgroundColor: COLORS.surface },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBox: { flex: 1, marginLeft: 4 },
  title: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 1 },
});
