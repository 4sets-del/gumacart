import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform, Image,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";

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

const PILLARS = [
  { icon: "🔒", title: "Safe",         desc: "Only SLSU members. No strangers, no scammers.", color: "#2980b9" },
  { icon: "🤝", title: "Trusted",      desc: "Verified student badges build community trust.", color: GREEN },
  { icon: "💸", title: "Affordable",   desc: "No fees. Free for all SLSU members.",            color: "#e67e22" },
  { icon: "🏫", title: "Campus-Based", desc: "Meet up safely within SLSU grounds.",            color: "#9b59b6" },
];

export default function AboutScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="dark-content" backgroundColor={LIGHT_BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Settings"); }}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* App Hero */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconCircle}>
            <Text style={styles.heroIcon}>🛒</Text>
          </View>
          <Text style={styles.heroAppName}>SLSU-GumaCart</Text>
          <Text style={styles.heroTagline}>The Official SLSU Student Marketplace</Text>
          <View style={styles.versionPill}>
            <Text style={styles.heroVersion}>Version 1.0.0</Text>
          </View>
        </View>

        {/* The Story */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Story</Text>
          <View style={styles.storyCard}>
            <Text style={styles.storyQuote}>"</Text>
            <Text style={styles.storyText}>
              Many students at Southern Leyte State University find it hard to buy and sell things around the campus. Some students need cheap items for their studies and daily life, while others have things they want to sell but have no safe and easy way to do it inside the school.
            </Text>
            <Text style={styles.storyText}>
              The apps most people use for buying and selling are open to everyone. This means students often deal with strangers, which can feel unsafe and hard to trust. These apps were also not made for the needs of a school community.
            </Text>
            <Text style={styles.storyText}>
              To help solve this problem, the researchers created a marketplace made only for the SLSU community. The app lets verified students and faculty buy, sell, barter, and donate items more safely, because everyone on the app is part of the same university.
            </Text>
            <Text style={styles.storyText}>
              This app is <Text style={styles.storyAppName}>SLSU-GumaCart</Text> — a safe, campus-only marketplace made by students of Southern Leyte State University for their own community.
            </Text>
          </View>
        </View>

        {/* Mission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <View style={styles.missionCard}>
            <View style={styles.missionIconCircle}>
              <Text style={styles.missionIcon}>🎯</Text>
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
            {PILLARS.map((p) => (
              <View key={p.title} style={[styles.pillarCard, { borderTopColor: p.color }]}>
                <View style={[styles.pillarIconBox, { backgroundColor: p.color + "15" }]}>
                  <Text style={styles.pillarIcon}>{p.icon}</Text>
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
          <Text style={styles.footerText}>Made with ❤️ for the SLSU Community</Text>
          <Text style={styles.footerSub}>© 2026 SLSU-GumaCart · Southern Leyte State University</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT_BG, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: LIGHT_BG, borderBottomWidth: 1, borderBottomColor: "#E0E8DB" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E8DB", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: GREEN },

  // Hero
  heroBanner: { margin: 20, backgroundColor: GREEN, borderRadius: 24, padding: 32, alignItems: "center", elevation: 4, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  heroIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  heroIcon: { fontSize: 42 },
  heroAppName: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 6, letterSpacing: -0.3 },
  heroTagline: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 14, textAlign: "center" },
  versionPill: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  heroVersion: { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "600" },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 14 },

  // Story
  storyCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#E8EDE5", padding: 22, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  storyQuote: { fontSize: 56, color: GREEN, lineHeight: 48, fontWeight: "800", marginBottom: 4, opacity: 0.3 },
  storyText: { fontSize: 14, color: "#444", lineHeight: 23, marginBottom: 14 },
  storyAppName: { fontWeight: "700", color: GREEN },

  // Mission
  missionCard: { backgroundColor: "#E8F5EC", borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "flex-start", gap: 14, borderWidth: 1, borderColor: "#C8E6D0" },
  missionIconCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  missionIcon: { fontSize: 24 },
  missionText: { flex: 1, fontSize: 14, color: GREEN, lineHeight: 22, fontWeight: "500" },

  // Pillars
  pillarsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pillarCard: { width: "47%", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E8EDE5", borderTopWidth: 4, padding: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  pillarIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  pillarIcon: { fontSize: 22 },
  pillarTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  pillarDesc: { fontSize: 12, color: "#888", lineHeight: 18 },

  // Makers
  makerCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#E8EDE5", padding: 18, marginBottom: 12, flexDirection: "row", alignItems: "flex-start", gap: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  makerAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#D0E8D8" },
  makerAvatarText: { fontSize: 28, fontWeight: "800", color: "#fff" },
  makerPhoto: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: "#D0E8D8" },
  makerInfo: { flex: 1 },
  makerName: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 6 },
  makerRolePill: { alignSelf: "flex-start", backgroundColor: "#E8F5EC", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  makerRoleText: { fontSize: 11, color: GREEN, fontWeight: "700" },
  makerDesc: { fontSize: 13, color: "#555", lineHeight: 20 },

  // Footer
  footer: { marginHorizontal: 20, marginTop: 4, marginBottom: 20, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#E8EDE5", padding: 22, alignItems: "center" },
  footerText: { fontSize: 14, color: GREEN, fontWeight: "700", marginBottom: 6 },
  footerSub: { fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 16 },
});
