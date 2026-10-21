import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SPACING, FONTS } from '../constants/theme';

// White top bar used across screens: back arrow, bold title, optional
// subtitle and right-side element. Handles the status bar inset itself.
export default function ScreenHeader({ title, subtitle, onBack, right, border = false }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }, border && styles.border]}>
      <StatusBar barStyle="dark-content" />
      {onBack ? (
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

export function HeaderButton({ icon, onPress, color = COLORS.textPrimary, badge }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name={icon} size={22} color={color} />
      {badge ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm, backgroundColor: COLORS.white },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBox: { flex: 1, marginLeft: 4 },
  title: { fontSize: 20, fontFamily: FONTS.heading, color: COLORS.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 1 },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: FONTS.heading },
});
