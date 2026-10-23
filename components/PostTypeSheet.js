import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import Sheet from './Sheet';

// The four kinds of post, in the same order and colors as Create Listing.
const POST_TYPES = (COLORS) => ([
  { id: 'sell',   label: 'For Sale',    sub: 'Sell something you own',     icon: 'pricetag',        color: COLORS.sell,   bg: COLORS.sellBg },
  { id: 'buy',    label: 'Looking For', sub: 'Ask for an item you need',   icon: 'search',          color: COLORS.buy,    bg: COLORS.buyBg },
  { id: 'barter', label: 'Barter',      sub: 'Trade one item for another', icon: 'swap-horizontal', color: COLORS.barter, bg: COLORS.barterBg },
  { id: 'donate', label: 'Donate',      sub: 'Give it away for free',      icon: 'gift',            color: COLORS.donate, bg: COLORS.donateBg },
]);

// Opened by the "+" Post tab: pick what kind of listing to create.
export default function PostTypeSheet({ visible, onClose, onPick }) {
  const { COLORS, styles } = useTheme(createStyles);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="What do you want to post?"
      subtitle="Choose a type. You can still change it on the next screen."
      icon="add"
      footer={null}
    >
      <View style={styles.grid}>
        {POST_TYPES(COLORS).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.card, { backgroundColor: t.bg, borderColor: t.color + '33' }]}
            activeOpacity={0.8}
            onPress={() => onPick(t.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t.label}: ${t.sub}`}
          >
            <View style={[styles.iconCircle, { backgroundColor: t.color }]}>
              <Ionicons name={t.icon} size={22} color="#fff" />
            </View>
            <Text style={[styles.label, { color: t.color }]}>{t.label}</Text>
            <Text style={styles.sub}>{t.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Sheet>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 4 },
  card: { width: '48.5%', flexGrow: 1, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, gap: 4 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  label: { fontSize: 16, fontFamily: FONTS.heading },
  sub: { fontSize: 12.5, lineHeight: 17, color: COLORS.textSecondary },
});
