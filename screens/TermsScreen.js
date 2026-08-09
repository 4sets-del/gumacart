import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar, Platform,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";

const TERMS = [
  {
    title: "1. Eligibility",
    content: `SLSU-GumaCart is exclusively available to currently enrolled students and faculty members of Southern Luzon State University (SLSU). By using this app, you confirm that you are a legitimate member of the SLSU community.\n\nUsers who are found to be non-members of the SLSU community may have their accounts suspended or permanently removed.`,
  },
  {
    title: "2. Acceptable Use",
    content: `You may use SLSU-GumaCart to:\n• Sell personal items you legitimately own\n• Buy items from fellow SLSU members\n• Barter or exchange items with other members\n• Donate items to the SLSU community\n\nYou may NOT use SLSU-GumaCart to:\n• Sell stolen, counterfeit, or illegal goods\n• Post misleading, false, or fraudulent listings\n• Harass, threaten, or abuse other users\n• Engage in scamming or dishonest transactions\n• Sell prohibited items (weapons, drugs, alcohol, adult content)`,
  },
  {
    title: "3. Listing Rules",
    content: `All listings must:\n• Accurately describe the item being sold, bartered, or donated\n• Include a real photo of the actual item\n• Show the honest condition of the item (New, Like New, Good, Fair, Poor)\n• Be priced fairly and honestly\n\nListings found to be misleading or fraudulent will be removed and the account may be banned.`,
  },
  {
    title: "4. Transactions and Meet-Ups",
    content: `SLSU-GumaCart facilitates connections between buyers and sellers but is NOT a party to any transaction. All transactions are between users directly.\n\n• Meet-ups are strongly recommended to be done on SLSU campus grounds during school hours for your safety\n• Always inspect an item before completing a transaction\n• SLSU-GumaCart is not responsible for any disputes, losses, or damages arising from transactions\n• Users are encouraged to rate sellers honestly after a transaction`,
  },
  {
    title: "5. Prohibited Items",
    content: `The following items are strictly prohibited on SLSU-GumaCart:\n• Illegal drugs or drug paraphernalia\n• Weapons of any kind\n• Alcoholic beverages\n• Pirated or counterfeit goods (e.g. fake textbooks, copied software)\n• Stolen property\n• Adult or sexually explicit content\n• Live animals\n• Prescription medications\n\nViolators will be permanently banned and may be reported to SLSU administration.`,
  },
  {
    title: "6. Verification",
    content: `SLSU-GumaCart offers a student verification system that requires submission of a valid SLSU Student ID. Verified accounts display an ✅ SLSU Verified badge.\n\nVerification:\n• Helps build trust between buyers and sellers\n• Does NOT guarantee the quality or legitimacy of listings\n• May be revoked if fraudulent documents are submitted\n\nSubmitting fake or altered IDs for verification is a violation that may be escalated to SLSU administration.`,
  },
  {
    title: "7. Ratings and Reviews",
    content: `Users may rate and review sellers after a transaction. Reviews must be:\n• Honest and based on your actual experience\n• Free from offensive language or personal attacks\n• Not used to manipulate or extort sellers\n\nFalse or malicious reviews may be removed. Attempting to manipulate ratings is a violation of these terms.`,
  },
  {
    title: "8. Privacy",
    content: `SLSU-GumaCart collects the following information:\n• Name and email address (from registration)\n• Student ID photo (for verification purposes only)\n• Listing information and messages\n\nYour information is used solely to operate the app and will not be shared with third parties. Messages between users are stored to enable communication within the app.\n\nBy using SLSU-GumaCart, you consent to this data collection.`,
  },
  {
    title: "9. Account Suspension and Banning",
    content: `SLSU-GumaCart administrators reserve the right to suspend or permanently ban any account that:\n• Violates these Terms and Conditions\n• Receives multiple legitimate complaints from other users\n• Is found to be fraudulent or misleading\n• Engages in harassment or abusive behavior\n\nBanned users may not create new accounts. Persistent violations may be reported to SLSU administration.`,
  },
  {
    title: "10. Disclaimer of Liability",
    content: `SLSU-GumaCart is a student marketplace platform and does not:\n• Guarantee the quality, safety, or legality of any listed item\n• Take responsibility for disputes between buyers and sellers\n• Provide buyer or seller protection\n• Verify the accuracy of listing descriptions\n\nUse this platform at your own risk. Always exercise caution when transacting with others, even within the SLSU community.`,
  },
  {
    title: "11. Changes to Terms",
    content: `These Terms and Conditions may be updated from time to time to reflect changes in the app or SLSU policies. Continued use of the app after changes are made constitutes acceptance of the updated terms.\n\nUsers will be notified of major changes within the app.`,
  },
  {
    title: "12. Contact",
    content: `If you have concerns, disputes, or want to report a violation, please contact the SLSU-GumaCart admin through the app or reach out to the SLSU administration office.\n\nFor scam reports or serious violations, please report directly to the SLSU Office of Student Affairs.`,
  },
];

export default function TermsScreen({ navigation }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="dark-content" backgroundColor={LIGHT_BG} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Settings"); }}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.introBanner}>
          <View style={styles.introIconCircle}>
            <Ionicons name="document-text" size={30} color="#fff" />
          </View>
          <Text style={styles.introTitle}>SLSU-GumaCart</Text>
          <Text style={styles.introSubtitle}>Terms and Conditions</Text>
          <View style={styles.introDatePill}>
            <Text style={styles.introDate}>Effective: June 2025</Text>
          </View>
          <Text style={styles.introText}>
            Please read these terms carefully before using the SLSU-GumaCart marketplace. By creating an account or listing an item, you agree to be bound by these terms.
          </Text>
        </View>
        <View style={styles.termsContainer}>
          {TERMS.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.termCard, expanded === index && styles.termCardExpanded]}
              onPress={() => setExpanded(expanded === index ? null : index)}
              activeOpacity={0.8}
            >
              <View style={styles.termHeader}>
                <View style={[styles.termNumBadge, expanded === index && styles.termNumBadgeActive]}>
                  <Text style={[styles.termNumText, expanded === index && styles.termNumTextActive]}>{index + 1}</Text>
                </View>
                <Text style={styles.termTitle}>{section.title.replace(/^\d+\.\s*/, "")}</Text>
                <Ionicons name={expanded === index ? "chevron-up" : "chevron-down"} size={16} color={expanded === index ? GREEN : "#bbb"} />
              </View>
              {expanded === index && (
                <Text style={styles.termContent}>{section.content}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using SLSU-GumaCart, you agree to these Terms and Conditions and commit to being a responsible member of the SLSU marketplace community.
          </Text>
          <View style={styles.footerSubRow}>
            <Ionicons name="school" size={14} color={GREEN} style={{ marginRight: 6 }} />
            <Text style={styles.footerSub}>For SLSU Students and Faculty Only</Text>
          </View>
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
  introBanner: { margin: 20, backgroundColor: GREEN, borderRadius: 22, padding: 26, alignItems: "center", elevation: 4, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  introIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  introTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 2 },
  introSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 12 },
  introDatePill: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 14 },
  introDate: { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  introText: { fontSize: 13, color: "rgba(255,255,255,0.9)", textAlign: "center", lineHeight: 20 },
  termsContainer: { paddingHorizontal: 20, gap: 10 },
  termCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E8EDE5", padding: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  termCardExpanded: { borderColor: GREEN, borderWidth: 1.5 },
  termHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  termNumBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  termNumBadgeActive: { backgroundColor: GREEN },
  termNumText: { fontSize: 13, fontWeight: "800", color: "#999" },
  termNumTextActive: { color: "#fff" },
  termTitle: { fontSize: 14, fontWeight: "700", color: "#222", flex: 1 },
  termContent: { fontSize: 13, color: "#555", lineHeight: 22, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  footer: { margin: 20, backgroundColor: "#E8F5EC", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#C8E6D0" },
  footerText: { fontSize: 13, color: GREEN, textAlign: "center", lineHeight: 20, marginBottom: 10 },
  footerSubRow: { flexDirection: "row", alignItems: "center" },
  footerSub: { fontSize: 13, fontWeight: "700", color: GREEN },
});
