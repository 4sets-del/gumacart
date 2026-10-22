import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenHeader from '../components/ScreenHeader';
import { RADIUS, SHADOWS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_EFFECTIVE } from '../constants/privacy';

export default function PrivacyScreen({ navigation }) {
  const { styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.safe}>
      <ScreenHeader title="Privacy Policy" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </View>
          <Text style={styles.bannerTitle}>Your privacy</Text>
          <Text style={styles.bannerDate}>Effective {PRIVACY_EFFECTIVE}</Text>
          <Text style={styles.bannerText}>{PRIVACY_INTRO}</Text>
        </View>

        {PRIVACY_SECTIONS.map((section, i) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
              <Text style={styles.cardTitle}>{section.title}</Text>
            </View>
            {section.points.map((point) => (
              <View key={point} style={styles.point}>
                <View style={styles.bullet} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  banner: { margin: 16, backgroundColor: COLORS.primary, borderRadius: 22, padding: 22, alignItems: 'center' },
  bannerIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  bannerTitle: { fontSize: 21, fontFamily: FONTS.heading, color: '#fff' },
  bannerDate: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, marginBottom: 12 },
  bannerText: { fontSize: 13, color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 20 },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 12.5, fontFamily: FONTS.heading, color: COLORS.primary },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  point: { flexDirection: 'row', gap: 10, marginTop: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 8 },
  pointText: { flex: 1, fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 21 },
});
