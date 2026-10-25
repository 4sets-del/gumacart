import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import Sheet from './Sheet';
import { canPostType } from '../constants/school';

// The four kinds of post, in the same order and colors as Create Listing.
export const POST_TYPES = (COLORS) => ([
  { id: 'sell',   label: 'For Sale',    sub: 'Sell something you own',     icon: 'pricetag',        color: COLORS.sell,   bg: COLORS.sellBg },
  { id: 'buy',    label: 'Looking For', sub: 'Ask for an item you need',   icon: 'search',          color: COLORS.buy,    bg: COLORS.buyBg },
  { id: 'barter', label: 'Barter',      sub: 'Trade one item for another', icon: 'swap-horizontal', color: COLORS.barter, bg: COLORS.barterBg },
  { id: 'donate', label: 'Donate',      sub: 'Give it away for free',      icon: 'gift',            color: COLORS.donate, bg: COLORS.donateBg },
]);

export function postTypeMeta(COLORS, id) {
  const list = POST_TYPES(COLORS);
  return list.find((t) => t.id === id) || list[0];
}

// Opened by the "+" Post tab (and "Change" on Create Listing): pick what kind
// of listing to create. `selected` highlights the current choice.
// `profile` is the signed-in user's profile: types that need a verified
// student ID are greyed out and can't be tapped until they're verified.
export default function PostTypeSheet({ visible, onClose, onPick, selected, profile, onVerify, title = 'What do you want to post?' }) {
  const { COLORS, styles } = useTheme(createStyles);
  const types = POST_TYPES(COLORS);
  const anyLocked = types.some((t) => !canPostType(profile, t.id));
  const pending = profile?.verificationStatus === 'pending';
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={selected ? 'Your photos and details stay as they are.' : 'Choose a type. You can change it later.'}
      icon="add"
      footer={null}
    >
      <View style={styles.grid}>
        {types.map((t) => {
          const locked = !canPostType(profile, t.id);
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.card,
                locked
                  ? styles.cardLocked
                  : [{ backgroundColor: t.bg, borderColor: t.id === selected ? t.color : t.color + '33' }, t.id === selected && styles.cardOn],
              ]}
              activeOpacity={0.8}
              onPress={() => onPick(t.id)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              accessibilityLabel={locked ? `${t.label}: needs a verified student ID` : `${t.label}: ${t.sub}`}
            >
              <View style={[styles.iconCircle, { backgroundColor: locked ? COLORS.borderStrong : t.color }]}>
                <Ionicons name={t.icon} size={22} color="#fff" />
              </View>
              {locked ? (
                <Ionicons name="lock-closed" size={16} color={COLORS.textMuted} style={styles.check} />
              ) : t.id === selected ? (
                <Ionicons name="checkmark-circle" size={20} color={t.color} style={styles.check} />
              ) : null}
              <Text style={[styles.label, { color: locked ? COLORS.textMuted : t.color }]}>{t.label}</Text>
              <Text style={styles.sub}>{locked ? 'Needs a verified student ID' : t.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {anyLocked ? (
        <TouchableOpacity style={styles.verifyBar} activeOpacity={pending ? 1 : 0.85} onPress={pending ? undefined : onVerify} disabled={pending || !onVerify}>
          <Ionicons name={pending ? 'hourglass' : 'shield-checkmark'} size={18} color={pending ? COLORS.warning : COLORS.primary} />
          <Text style={styles.verifyText}>
            {pending
              ? 'Your student ID is being reviewed. Selling, bartering and donating unlock once it\'s approved.'
              : 'Verify your student ID once to sell, barter or donate.'}
          </Text>
          {!pending ? <Text style={styles.verifyLink}>Verify</Text> : null}
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 4 },
  card: { width: '48.5%', flexGrow: 1, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, gap: 4 },
  cardOn: { borderWidth: 2 },
  cardLocked: { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, opacity: 0.6 },
  verifyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryPale },
  verifyText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
  verifyLink: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary },
  check: { position: 'absolute', top: 12, right: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  label: { fontSize: 16, fontFamily: FONTS.heading },
  sub: { fontSize: 12.5, lineHeight: 17, color: COLORS.textSecondary },
});
