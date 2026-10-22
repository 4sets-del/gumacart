import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
} from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenHeader from "../components/ScreenHeader";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { RADIUS, SHADOWS, FONTS } from "../constants/theme";
import { useTheme } from '../context/ThemeContext';


const MAKERS = [
  {
    name: "Raymark Barrios",
    role: "Researcher",
    initial: "R",
    // To show a real photo: add the file to /assets and set e.g. photo: require("../assets/team-raymark.jpg")
    photo: null,
    desc: "Conceptualized the idea behind SLSU-GumaCart after recognizing the need for a dedicated marketplace within the university, and provided the overall direction of the project.",
  },
  {
    name: "Omar Gerez",
    role: "Lead Developer",
    initial: "O",
    photo: null,
    desc: "Led the development of the application, overseeing its features and functionality to ensure that the system effectively meets the needs of the SLSU community.",
  },
  {
    name: "Mechaella Alday",
    role: "Co-Researcher",
    initial: "M",
    photo: null,
    desc: "Worked together with Raymark in shaping the idea behind SLSU-GumaCart, helping plan its goals and features to make sure the app truly fits the needs of the SLSU community.",
  },
];

const PILLARS = (COLORS) => ([
  { icon: "lock-closed",     title: "Safe",         desc: "Only SLSU members. No strangers, no scammers.", color: "#2563EB" },
  { icon: "shield-checkmark", title: "Trusted",     desc: "Verified student badges build community trust.", color: COLORS.primary },
  { icon: "cash",            title: "Affordable",   desc: "No fees. Free for all SLSU members.",            color: "#EA580C" },
  { icon: "school",          title: "Campus-Based", desc: "Meet up safely within SLSU grounds.",            color: "#7C3AED" },
]);

export default function AboutScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  return (
    <View style={styles.safe}>
      <ScreenHeader
        title="About"
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Settings"); }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* App Hero */}
        <View style={styles.heroBanner}>
          {/* Campus photo under a green tint */}
          <Image source={require("../assets/slsu-campus.jpg")} style={styles.heroPhoto} resizeMode="cover" />
          <LinearGradient colors={["rgba(20,83,43,0.55)", "rgba(20,83,43,0.92)"]} style={StyleSheet.absoluteFill} />
          <Image source={require("../assets/icon.png")} style={styles.heroLogo} />
          <Text style={styles.heroAppName}>SLSU-GumaCart</Text>
          <Text style={styles.heroTagline}>The Official SLSU Student Marketplace</Text>
          <View style={styles.versionPill}>
            <Text style={styles.heroVersion}>Version {Constants.expoConfig?.version || "1.0.0"}</Text>
          </View>
        </View>

        {/* The Story */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Story</Text>
          <View style={styles.storyCard}>
            <Text style={styles.storyQuote}>"</Text>
            <Text style={styles.storyText}>
              Many students at Southern Luzon State University find it hard to buy and sell things around the campus. Some students need cheap items for their studies and daily life, while others have things they want to sell but have no safe and easy way to do it inside the school.
            </Text>
            <Text style={styles.storyText}>
              The apps most people use for buying and selling are open to everyone. This means students often deal with strangers, which can feel unsafe and hard to trust. These apps were also not made for the needs of a school community.
            </Text>
            <Text style={styles.storyText}>
              To help solve this problem, the researchers created a marketplace made only for the SLSU community. The app lets verified students and faculty buy, sell, barter, and donate items more safely, because everyone on the app is part of the same university.
            </Text>
            <Text style={styles.storyText}>
              This app is <Text style={styles.storyAppName}>SLSU-GumaCart</Text> — a safe, campus-only marketplace made by students of Southern Luzon State University for their own community.
            </Text>
          </View>
        </View>

        {/* Mission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <View style={styles.missionCard}>
            <View style={styles.missionIconCircle}>
              <Ionicons name="flag" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.missionText}>
              To provide a safe, accessible, and trusted marketplace exclusively for the SLSU community — making it easier for students and faculty to buy, sell, barter, and donate within a circle they know and trust.
            </Text>
          </View>
        </View>

        {/* Why GumaCart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why GumaCart?</Text>
          <View style={styles.pillarsGrid}>
            {PILLARS(COLORS).map((p) => (
              <View key={p.title} style={[styles.pillarCard, { borderTopColor: p.color }]}>
                <View style={[styles.pillarIconBox, { backgroundColor: p.color + "15" }]}>
                  <Ionicons name={p.icon} size={21} color={p.color} />
                </View>
                <Text style={[styles.pillarTitle, { color: p.color }]}>{p.title}</Text>
                <Text style={styles.pillarDesc}>{p.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* The Makers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Researchers</Text>
          {MAKERS.map((maker, index) => (
            <View key={index} style={styles.makerCard}>
              {maker.photo ? (
                <Image source={maker.photo} style={styles.makerPhoto} />
              ) : (
                <View style={styles.makerAvatar}>
                  <Ionicons name="person" size={30} color="#fff" />
                </View>
              )}
              <View style={styles.makerInfo}>
                <Text style={styles.makerName}>{maker.name}</Text>
                <View style={styles.makerRolePill}>
                  <Text style={styles.makerRoleText}>{maker.role}</Text>
                </View>
                <Text style={styles.makerDesc}>{maker.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with <Ionicons name="heart" size={14} color={COLORS.error} /> for the SLSU Community</Text>
          <Text style={styles.footerSub}>© 2026 SLSU-GumaCart · Southern Luzon State University</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Hero
  heroBanner: { margin: 16, backgroundColor: COLORS.primary, borderRadius: 24, padding: 28, alignItems: "center", overflow: "hidden" },
  heroPhoto: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 420 },
  heroCircle: { position: "absolute", right: -50, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: COLORS.primaryLight, opacity: 0.5 },
  heroLogo: { width: 72, height: 72, borderRadius: 18, marginBottom: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },
  heroAppName: { fontSize: 26, fontFamily: FONTS.heading, color: "#fff", marginBottom: 6, letterSpacing: -0.3 },
  heroTagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 14, textAlign: "center" },
  versionPill: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 5 },
  heroVersion: { fontSize: 11, color: "#fff", fontWeight: "600" },

  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 12 },

  // Story
  storyCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 20, ...SHADOWS.sm },
  storyQuote: { fontSize: 56, color: COLORS.primary, lineHeight: 48, fontFamily: FONTS.heading, marginBottom: 4, opacity: 0.3 },
  storyText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 23, marginBottom: 14 },
  storyAppName: { fontWeight: "700", color: COLORS.primary },

  // Mission
  missionCard: { backgroundColor: COLORS.primaryPale, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  missionIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  missionIcon: { fontSize: 22 },
  missionText: { flex: 1, fontSize: 14, color: COLORS.primaryDark, lineHeight: 22, fontWeight: "500" },

  // Pillars
  pillarsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pillarCard: { width: "47.5%", backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderTopWidth: 3, padding: 14, ...SHADOWS.sm },
  pillarIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  pillarIcon: { fontSize: 21 },
  pillarTitle: { fontSize: 15, fontFamily: FONTS.heading, marginBottom: 4 },
  pillarDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  // Makers
  makerCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "flex-start", gap: 14, ...SHADOWS.sm },
  makerAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  makerAvatarText: { fontSize: 26, fontFamily: FONTS.heading, color: "#fff" },
  makerPhoto: { width: 64, height: 64, borderRadius: 32 },
  makerInfo: { flex: 1 },
  makerName: { fontSize: 16, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 6 },
  makerRolePill: { alignSelf: "flex-start", backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  makerRoleText: { fontSize: 11, color: COLORS.primary, fontWeight: "700" },
  makerDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  // Footer
  footer: { marginHorizontal: 16, marginTop: 4, marginBottom: 20, alignItems: "center", paddingVertical: 12 },
  footerText: { fontSize: 14, color: COLORS.primary, fontWeight: "700", marginBottom: 6 },
  footerSub: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", lineHeight: 16 },
});
