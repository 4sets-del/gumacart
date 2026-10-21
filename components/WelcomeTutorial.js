import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Dimensions, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from '../constants/theme';

const { width } = Dimensions.get("window");
const GREEN = "#1B6B3A";

// Each slide teaches one core part of the app.
const SLIDES = [
  {
    icon: "storefront",
    emoji: "🛍️",
    color: "#1B6B3A",
    title: "Welcome to GumaCart",
    text: "Your campus marketplace for Southern Luzon State University. Buy, sell, barter, and donate with fellow students — safely and easily.",
  },
  {
    icon: "pricetags",
    emoji: "🏷️",
    color: "#1565C0",
    title: "Four ways to trade",
    text: "Post an item For Sale, list what you're Looking For, offer a Barter to swap items, or Donate something for free to a schoolmate.",
  },
  {
    icon: "shield-checkmark",
    emoji: "✅",
    color: "#1B6B3A",
    title: "Verified students only",
    text: "Everyone verifies their SLSU student ID before posting. This keeps the marketplace trusted and safe for the whole campus.",
  },
  {
    icon: "chatbubbles",
    emoji: "💬",
    color: "#E65100",
    title: "Chat & meet on campus",
    text: "Message sellers directly to ask questions and agree on a safe campus meet-up spot like the Library or Main Gate.",
  },
  {
    icon: "flag",
    emoji: "🚩",
    color: "#C62828",
    title: "Report anything unsafe",
    text: "See something suspicious? Tap the flag to report a listing or user. Admins review every report to keep GumaCart safe.",
  },
];

export default function WelcomeTutorial({ visible, onClose }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);

  const goTo = (index) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const onScroll = (e) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const isLast = page === SLIDES.length - 1;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Skip */}
        <View style={styles.topBar}>
          {!isLast ? (
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 60 }} />}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((slide, i) => (
            <View key={i} style={[styles.slide, { width }]}>
              <View style={[styles.iconCircle, { backgroundColor: slide.color + "14" }]}>
                <Text style={styles.emoji}>{slide.emoji}</Text>
                <View style={[styles.iconBadge, { backgroundColor: slide.color }]}>
                  <Ionicons name={slide.icon} size={18} color="#fff" />
                </View>
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.text}>{slide.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* Bottom button */}
        <View style={styles.bottomBar}>
          {isLast ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => goTo(page + 1)}>
              <Text style={styles.primaryBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: { height: 54, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { fontSize: 15, color: "#999", fontWeight: "600" },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, paddingBottom: 40 },
  iconCircle: { width: 140, height: 140, borderRadius: 70, alignItems: "center", justifyContent: "center", marginBottom: 40, position: "relative" },
  emoji: { fontSize: 64 },
  iconBadge: { position: "absolute", bottom: 8, right: 8, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  title: { fontSize: 25, fontFamily: FONTS.heading, color: "#111", textAlign: "center", marginBottom: 16, letterSpacing: -0.4 },
  text: { fontSize: 15.5, color: "#777", textAlign: "center", lineHeight: 24 },
  dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 20 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24, backgroundColor: GREEN },
  dotInactive: { width: 8, backgroundColor: "#DDD" },
  bottomBar: { paddingHorizontal: 24, paddingBottom: 36 },
  primaryBtn: { flexDirection: "row", height: 56, borderRadius: 18, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  primaryBtnText: { fontSize: 16.5, fontFamily: FONTS.heading, color: "#fff" },
});
