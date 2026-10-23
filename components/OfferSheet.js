import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Sheet, { FormField, SheetSection } from './Sheet';
import { RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { listingImage, listingTitle } from '../constants/listings';

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

// "Make an Offer": pick one of the seller's items and propose a price.
// `items` are the seller's priced listings (ones mentioned in the chat first).
export default function OfferSheet({ visible, onClose, items, onSend, sending }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [selectedId, setSelectedId] = useState(null);
  const [amount, setAmount] = useState('');

  // Start with the first item each time the sheet opens.
  useEffect(() => {
    if (visible) { setSelectedId(items[0]?.id || null); setAmount(''); }
  }, [visible, items]);

  const item = items.find((i) => i.id === selectedId);
  const value = Number(amount);
  const error = amount && !(value > 0) ? 'Enter an amount greater than 0' : null;
  const suggest = (pct) => setAmount(String(Math.max(1, Math.round(item.price * (1 - pct)))));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Make an Offer"
      subtitle="Propose a price. The seller can accept or decline."
      icon="pricetag"
      busy={sending}
      action={{ title: 'Send Offer', icon: 'send', onPress: () => item && value > 0 && onSend(item, value), loading: sending, disabled: !item || !(value > 0) }}
    >
      <SheetSection title="Item" />
      <View style={styles.list}>
        {items.map((it) => {
          const on = it.id === selectedId;
          const img = listingImage(it);
          return (
            <TouchableOpacity key={it.id} style={[styles.item, on && styles.itemOn]} activeOpacity={0.8} onPress={() => setSelectedId(it.id)}>
              {img ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={COLORS.textMuted} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{listingTitle(it)}</Text>
                <Text style={styles.itemPrice}>Asking {peso(it.price)}</Text>
              </View>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>

      {item ? (
        <>
          <FormField
            label="Your offer (₱)"
            icon="cash-outline"
            keyboardType="numeric"
            placeholder={`e.g. ${Math.round(item.price * 0.9)}`}
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            error={error}
            hint={value > 0 && item.price ? `${Math.round((1 - value / item.price) * 100)}% below asking` : null}
          />
          <View style={styles.quickRow}>
            {[0.05, 0.1, 0.2].map((pct) => (
              <TouchableOpacity key={pct} style={styles.quick} onPress={() => suggest(pct)} activeOpacity={0.8}>
                <Text style={styles.quickText}>−{pct * 100}% · {peso(Math.round(item.price * (1 - pct)))}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  list: { gap: 8, marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1.5, borderColor: 'transparent' },
  itemOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  thumbEmpty: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14.5, fontWeight: '600', color: COLORS.textPrimary },
  itemPrice: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 1 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quick: { paddingHorizontal: 12, height: 34, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center' },
  quickText: { fontSize: 12.5, fontWeight: '700', color: COLORS.textSecondary },
});
