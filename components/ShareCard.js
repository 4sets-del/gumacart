import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, FONTS } from '../constants/theme';
import { listingImage, listingTitle, priceLabel, typeMeta, normalizeCategory } from '../constants/listings';

const W = 360; // drawn at a fixed size (off screen) and saved as a picture

// The picture made by "Share as image": listing photo, title, price and the
// GumaCart brand, sized for Facebook / Messenger posts. Rendered off screen;
// the product page captures it with react-native-view-shot.
const ShareCard = forwardRef(function ShareCard({ item, sellerLabel, onImageLoad }, ref) {
  const img = listingImage(item);
  const price = priceLabel(item);
  const badge = typeMeta(item.type).badge;
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.photoWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.photo} contentFit="cover" onLoad={onImageLoad} onError={onImageLoad} />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}><Text style={{ fontSize: 64 }}>🛍️</Text></View>
        )}
        {badge ? <View style={[styles.badge, { backgroundColor: typeMeta(item.type).color }]}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{listingTitle(item)}</Text>
        <Text style={styles.price}>{price.text}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.condition, normalizeCategory(item.category), item.location ? `Meet-up: ${item.location}` : null].filter(Boolean).join('  ·  ')}
        </Text>
        {sellerLabel ? <Text style={styles.seller} numberOfLines={1}>Posted by {item.sellerName || 'a student'} · {sellerLabel}</Text> : null}
      </View>
      <LinearGradient colors={GRADIENTS.primaryDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.footer}>
        <RNImage source={require('../assets/icon.png')} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>SLSU-GumaCart</Text>
          <Text style={styles.tag}>Buy · Sell · Exchange · Donate on campus</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  card: { width: W, backgroundColor: '#FFFFFF', borderRadius: 0, overflow: 'hidden' },
  photoWrap: { width: W, height: W, backgroundColor: '#EEF6F0' },
  photo: { width: W, height: W },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 14, left: 14, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 13, fontFamily: FONTS.heading, letterSpacing: 0.5 },
  body: { padding: 16, gap: 4 },
  title: { fontSize: 20, fontFamily: FONTS.heading, color: '#1A1D1B' },
  price: { fontSize: 24, fontFamily: FONTS.headingHeavy, color: '#1B6B3A' },
  meta: { fontSize: 13, color: '#59645C' },
  seller: { fontSize: 12.5, color: '#98A29A', marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  brand: { fontSize: 16, fontFamily: FONTS.heading, color: '#FFFFFF' },
  tag: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
});
