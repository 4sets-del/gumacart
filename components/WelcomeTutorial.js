import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GradientButton from "./GradientButton";
import { COLORS, FONTS, GRADIENTS } from "../constants/theme";

const { width } = Dimensions.get("window");

// Each slide teaches one core part of the app, with its own color.
const SLIDES = [
  {
    icon: "storefront",
    colors: GRADIENTS.primary,
    title: "Welcome to GumaCart",
    text: "Your campus marketplace for Southern Luzon State University. Buy, sell, barter, and donate with fellow students — safely and easily.",
  },
  {
    icon: "pricetags",
    colors: GRADIENTS.ocean,
    title: "Four ways to trade",
    text: "Post an item For Sale, list what you're Looking For, offer a Barter to swap items, or Donate something for free to a schoolmate.",
  },
  {
    icon: "shield-checkmark",
    colors: GRADIENTS.teal,
    title: "Verified students only",
    text: "Everyone verifies their SLSU student ID before posting. This keeps the marketplace trusted and safe for the whole campus.",
  },
  {
    icon: "chatbubbles",
    colors: GRADIENTS.sunset,
    title: "Chat & meet on campus",
    text: "Message sellers directly to ask questions and agree on a safe campus meet-up spot like the Library or Main Gate.",
  },
  {
    icon: "flag",
    colors: GRADIENTS.rose,
    title: "Report anything unsafe",
    text: "See something suspicious? Tap the flag to report a listing or user. Admins review every report to keep GumaCart safe.",
  },
];

export default function WelcomeTutorial({ visible, onClose }) {
  const insets = useSafeAreaInsets();
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
  const current = SLIDES[page];

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.counter}>{page + 1} / {SLIDES.length}</Text>
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
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <LinearGradient colors={slide.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroCircleBig} />
                <View style={styles.heroCircleSmall} />
                <View style={styles.iconCircle}>
                  <Ionicons name={slide.icon} size={58} color={slide.colors[0]} />
                </View>
              </LinearGradient>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.text}>{slide.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dotsRow}>
          {SLIDES.map((s, i) => (
            <TouchableOpacity key={s.title} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <View style={[styles.dot, i === page ? [styles.dotActive, { backgroundColor: current.colors[0] }] : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          <GradientButton
            title={isLast ? "Get Started" : "Next"}
            icon={isLast ? "checkmark-circle" : "arrow-forward"}
            colors={current.colors}
            height={56}
            onPress={isLast ? onClose : () => goTo(page + 1)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  counter: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: "600" },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 24 },
  hero: { width: "100%", height: 230, borderRadius: 32, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 36 },
  heroCircleBig: { position: "absolute", right: -50, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.14)" },
  heroCircleSmall: { position: "absolute", left: -30, bottom: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.10)" },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  title: { fontSize: 25, fontFamily: FONTS.heading, color: COLORS.textPrimary, textAlign: "center", marginBottom: 14, letterSpacing: -0.4 },
  text: { fontSize: 15.5, color: COLORS.textSecondary, textAlign: "center", lineHeight: 24 },
  dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 20 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 26 },
  dotInactive: { width: 8, backgroundColor: COLORS.border },
  bottomBar: { paddingHorizontal: 24 },
});
