import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, RefreshControl, Modal,
} from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  collection, getDocs, query, orderBy, where, limit, startAfter, getCountFromServer,
  doc, updateDoc, deleteDoc, serverTimestamp, getDoc, addDoc,
} from "firebase/firestore";
import { auth, db, functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { useActiveListings } from "../utils/useListings";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, RADIUS, SHADOWS, FONTS } from "../constants/theme";

const GREEN = COLORS.primary;
const LIGHT_BG = COLORS.background;
const AMBER = COLORS.warning;
const RED = COLORS.error;

const TABS = [
  { id: "verifications", label: "Verify",   icon: "school",      color: "#16A34A" },
  { id: "listings",      label: "Listings", icon: "pricetags",   color: "#2563EB" },
  { id: "reports",       label: "Reports",  icon: "flag",        color: "#E11D48" },
  { id: "appeals",       label: "Appeals",  icon: "mail-open",   color: "#7C3AED" },
  { id: "users",         label: "Users",    icon: "people",      color: "#EA580C" },
];

const BAN_REASONS = [
  "Spam or scam listings",
  "Harassment or abusive behavior",
  "Fake account or impersonation",
  "Prohibited or unsafe items",
  "Repeated violations after warnings",
  "Other — see admin notes",
];

const BAN_DURATIONS = [
  { key: "hour",      label: "1 Hour",    sub: "Short cool-off" },
  { key: "day",       label: "24 Hours",  sub: "One day suspension" },
  { key: "week",      label: "7 Days",    sub: "One week suspension" },
  { key: "permanent", label: "Permanent", sub: "Until manually lifted" },
];

export default function AdminPanelScreen({ navigation }) {
  const [activeTab, setActiveTab]       = useState("verifications");
  const [verifySubTab, setVerifySubTab] = useState("pending");
  const [listingSubTab, setListingSubTab] = useState("pending");
  const [reportSubTab, setReportSubTab] = useState("open");
  const [verifications, setVerifications] = useState([]);
  const [facultyRequests, setFacultyRequests] = useState([]);
  // Only pending listings are loaded here; approved ones come from the shared
  // active-listings listener the rest of the app already keeps in memory.
  const [listings, setListings]         = useState([]);
  const { listings: activeListings }    = useActiveListings({ includeOwn: true });
  // Users load page by page, only once the Users tab is opened.
  const [users, setUsers]               = useState([]);
  const [usersCursor, setUsersCursor]   = useState(null);
  const [usersLoaded, setUsersLoaded]   = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  // Totals for the stat cards, counted on the server (no documents downloaded).
  const [totals, setTotals]             = useState({ users: 0, listings: 0 });
  const [reports, setReports]           = useState([]);
  const [appeals, setAppeals]           = useState([]);
  const [viewerImage, setViewerImage]   = useState(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectUserId, setRejectUserId]   = useState(null);
  const [pendingReason, setPendingReason] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const [banVisible, setBanVisible]     = useState(false);
  const [banUserId, setBanUserId]       = useState(null);
  const [banUserName, setBanUserName]   = useState("");
  const [banReports, setBanReports]     = useState(null);
  const [banReason, setBanReason]       = useState(null);
  const [banDuration, setBanDuration]   = useState(null);

  useEffect(() => { checkAdminAndLoad(); }, []);

  const checkAdminAndLoad = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.data()?.role !== "admin") {
        Alert.alert("Access Denied", "You do not have admin privileges.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        return;
      }
      await loadAll();
    } catch (e) {} finally { setLoading(false); }
  };

  const loadTotals = async () => {
    try {
      const [u, l] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "listings")),
      ]);
      setTotals({ users: u.data().count, listings: l.data().count });
    } catch (e) {}
  };

  // Everything needed for the tab badges; the full user list waits for its tab.
  const loadAll = async () => Promise.all([
    loadTotals(), loadVerifications(), loadFacultyRequests(), loadListings(), loadReports(), loadAppeals(),
    usersLoaded ? loadUsers() : null,
  ]);

  const loadVerifications = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users"), where("verificationStatus", "in", ["pending", "verified", "rejected"])));
      setVerifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {}
  };

  const loadFacultyRequests = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users"), where("facultyRequest", "==", "pending")));
      setFacultyRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {}
  };

  const loadListings = async () => {
    try {
      const snap = await getDocs(query(collection(db, "listings"), where("status", "==", "pending")));
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {}
  };

  const loadReports = async () => {
    try {
      const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {}
  };

  const loadAppeals = async () => {
    try {
      const snap = await getDocs(query(collection(db, "appeals"), orderBy("createdAt", "desc")));
      setAppeals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      try {
        const snap2 = await getDocs(collection(db, "appeals"));
        setAppeals(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e2) {}
    }
  };

  const openReportTarget = async (report) => {
    if (report.kind === "user") {
      if (!report.reportedUserId) { Alert.alert("Unavailable", "This user no longer exists."); return; }
      navigation.navigate("SellerProfile", {
        sellerId: report.reportedUserId,
        sellerName: report.reportedUserName || "User",
      });
      return;
    }
    if (!report.listingId) { Alert.alert("Unavailable", "This listing no longer exists."); return; }
    try {
      const snap = await getDoc(doc(db, "listings", report.listingId));
      if (!snap.exists()) {
        Alert.alert("Listing removed", "This listing has already been deleted.");
        return;
      }
      navigation.navigate("ProductDetail", { product: { id: snap.id, ...snap.data() } });
    } catch (e) {
      Alert.alert("Error", "Could not open this listing.");
    }
  };

  const markReportsResolved = async (reportsArr, status) => {
    for (const r of reportsArr) {
      try {
        await updateDoc(doc(db, "reports", r.id), {
          status,
          resolvedAt: serverTimestamp(),
          resolvedBy: auth.currentUser.uid,
        });
      } catch (e) {}
    }
  };

  const dismissReportGroup = (group) => {
    const targetName = group.kind === "listing" ? (group.listingName || "this listing") : (group.reportedUserName || "this user");
    const n = group.reports.length;
    Alert.alert("Dismiss Report" + (n > 1 ? "s" : ""), `Dismiss ${n} report${n > 1 ? "s" : ""} about "${targetName}"? No action will be taken.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Dismiss", onPress: async () => {
        try {
          await markReportsResolved(group.reports, "dismissed");
          await loadReports();
        } catch (e) { Alert.alert("Error", "Could not dismiss."); }
      }},
    ]);
  };

  const removeReportedListingGroup = (group) => {
    const n = group.reports.length;
    Alert.alert("Remove Listing", `Delete "${group.listingName || "this listing"}" and resolve ${n} report${n > 1 ? "s" : ""}? The seller will be notified.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          let sellerId = null;
          let listingName = group.listingName || "your listing";
          if (group.listingId) {
            try {
              const snap = await getDoc(doc(db, "listings", group.listingId));
              if (snap.exists()) {
                sellerId = snap.data().sellerId || null;
                listingName = snap.data().name || listingName;
              }
            } catch (e) {}
            try { await deleteDoc(doc(db, "listings", group.listingId)); } catch (e) {}
          }
          if (sellerId) {
            try {
              await addDoc(collection(db, "users", sellerId, "notifications"), {
                type: "system",
                title: "Listing removed",
                body: `Your listing "${listingName}" was removed by an admin after being reported. Please review the community guidelines before posting again.`,
                read: false,
                createdAt: serverTimestamp(),
              });
            } catch (e) {}
          }
          await markReportsResolved(group.reports, "resolved");
          await loadReports();
          await loadListings();
          Alert.alert("Resolved", "Listing removed. Seller and reporter(s) notified.");
        } catch (e) { Alert.alert("Error", "Could not resolve report."); }
      }},
    ]);
  };

  const approveAppeal = (appeal) => {
    Alert.alert("Approve Appeal", `Restore ${appeal.userName || "this user"}'s access? They'll become a student again.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unban", onPress: async () => {
        try {
          await updateDoc(doc(db, "users", appeal.userId), {
            role: "student", bannedUntil: null, banReason: null,
          });
          await updateDoc(doc(db, "appeals", appeal.id), {
            status: "approved",
            resolvedAt: serverTimestamp(),
            resolvedBy: auth.currentUser.uid,
          });
          await loadAppeals();
          await loadUsers();
          Alert.alert("Restored", "The user has been unbanned and notified.");
        } catch (e) { Alert.alert("Error", "Could not approve the appeal."); }
      }},
    ]);
  };

  const rejectAppeal = (appeal) => {
    Alert.alert("Reject Appeal", `Decline ${appeal.userName || "this user"}'s appeal? They stay banned.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => {
        try {
          await updateDoc(doc(db, "appeals", appeal.id), {
            status: "rejected",
            resolvedAt: serverTimestamp(),
            resolvedBy: auth.currentUser.uid,
          });
          await loadAppeals();
          Alert.alert("Appeal declined", "The user has been notified.");
        } catch (e) { Alert.alert("Error", "Could not reject the appeal."); }
      }},
    ]);
  };

  const approveListing = async (listingId) => {
    try {
      await updateDoc(doc(db, "listings", listingId), { status: "active", approvedAt: serverTimestamp() });
      await loadListings();
    } catch (e) { Alert.alert("Error", "Could not approve listing."); }
  };

  const rejectListing = (listingId) => {
    Alert.alert("Reject Listing", "Reject this listing? The seller will be notified and can edit and re-submit it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => {
        try {
          await updateDoc(doc(db, "listings", listingId), { status: "rejected", rejectedAt: serverTimestamp() });
          await loadListings();
        } catch (e) { Alert.alert("Error", "Could not reject listing."); }
      }},
    ]);
  };

  const USERS_PAGE = 50;
  // Loads the first page (or the next one with `more`), newest accounts first.
  const loadUsers = async (more = false) => {
    if (loadingUsers) return;
    setLoadingUsers(true);
    try {
      const base = [collection(db, "users"), orderBy("createdAt", "desc")];
      const q = more && usersCursor
        ? query(...base, startAfter(usersCursor), limit(USERS_PAGE))
        : query(...base, limit(USERS_PAGE));
      const snap = await getDocs(q);
      const page = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers((prev) => (more ? [...prev, ...page] : page));
      setUsersCursor(snap.docs[snap.docs.length - 1] || null);
      setHasMoreUsers(snap.size === USERS_PAGE);
      setUsersLoaded(true);
    } catch (e) {} finally { setLoadingUsers(false); }
  };

  useEffect(() => {
    if (activeTab === "users" && !usersLoaded) loadUsers();
  }, [activeTab]);

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const approveVerification = async (userId) => {
    Alert.alert("Approve", "Approve this student verification?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: async () => {
        try {
          await updateDoc(doc(db, "users", userId), {
            verificationStatus: "verified",
            "verification.status": "approved",
            "verification.reviewedAt": serverTimestamp(),
            "verification.reviewedBy": auth.currentUser.uid,
          });
          await loadVerifications();
        } catch (e) { Alert.alert("Error", "Failed to approve."); }
      }},
    ]);
  };

  const approveFaculty = (userId, userName) => {
    Alert.alert("Approve Faculty", `Grant faculty status to ${userName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: async () => {
        try {
          await updateDoc(doc(db, "users", userId), {
            role: "faculty",
            facultyRequest: "approved",
            "facultyReview.reviewedAt": serverTimestamp(),
            "facultyReview.reviewedBy": auth.currentUser.uid,
          });
          await loadFacultyRequests();
          await loadUsers();
        } catch (e) { Alert.alert("Error", "Failed to approve faculty request."); }
      }},
    ]);
  };

  const rejectFaculty = (userId, userName) => {
    Alert.alert("Reject Faculty", `Decline the faculty request from ${userName}? They stay a student.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => {
        try {
          await updateDoc(doc(db, "users", userId), {
            facultyRequest: "rejected",
            "facultyReview.reviewedAt": serverTimestamp(),
            "facultyReview.reviewedBy": auth.currentUser.uid,
          });
          await loadFacultyRequests();
        } catch (e) { Alert.alert("Error", "Failed to reject faculty request."); }
      }},
    ]);
  };

  const REJECT_REASONS = [
    "ID photo is blurry or unreadable",
    "ID does not belong to SLSU",
    "Selfie does not match the ID",
    "Incomplete or invalid information",
    "Other — please re-submit",
  ];

  const openReject = (userId) => {
    setRejectUserId(userId);
    setPendingReason(null);
    setRejectVisible(true);
  };

  const submitReject = async () => {
    const reason = pendingReason;
    const userId = rejectUserId;
    setRejectVisible(false);
    setPendingReason(null);
    setRejectUserId(null);
    try {
      await updateDoc(doc(db, "users", userId), {
        verificationStatus: "rejected",
        rejectionReason: reason,
        "verification.status": "rejected",
        "verification.reason": reason,
        "verification.reviewedAt": serverTimestamp(),
        "verification.reviewedBy": auth.currentUser.uid,
      });
      await loadVerifications();
      Alert.alert("Rejected", "The student has been notified with the reason.");
    } catch (e) { Alert.alert("Error", "Failed to reject."); }
  };

  const deleteListing = async (listingId) => {
    Alert.alert("Delete Listing", "Permanently delete this listing?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await deleteDoc(doc(db, "listings", listingId)); await loadListings(); }
        catch (e) { Alert.alert("Error", "Failed to delete."); }
      }},
    ]);
  };

  const openBan = (userId, userName, reportGroup = null) => {
    setBanUserId(userId);
    setBanUserName(userName || "this user");
    setBanReports(reportGroup);
    setBanReason(null);
    setBanDuration(null);
    setBanVisible(true);
  };

  const computeBannedUntil = (duration) => {
    if (duration === "permanent") return null;
    const now = Date.now();
    const ms = duration === "hour" ? 3600e3
      : duration === "day" ? 86400e3
      : duration === "week" ? 604800e3
      : 0;
    return new Date(now + ms);
  };

  const submitBan = async () => {
    if (!banReason || !banDuration) {
      Alert.alert("Incomplete", "Please choose a reason and a duration.");
      return;
    }
    const userId = banUserId;
    const uName = banUserName;
    const bannedUntil = computeBannedUntil(banDuration);
    const reportGroup = banReports;
    const durLabel = BAN_DURATIONS.find((d) => d.key === banDuration)?.label || "";
    setBanVisible(false);
    try {
      await updateDoc(doc(db, "users", userId), {
        role: "banned",
        banReason,
        bannedUntil: bannedUntil ? bannedUntil : null,
        bannedAt: serverTimestamp(),
        bannedBy: auth.currentUser.uid,
      });
      if (reportGroup?.reports?.length) {
        await markReportsResolved(reportGroup.reports, "resolved");
      }
      await loadUsers();
      await loadReports();
      Alert.alert("User banned", `${uName} was suspended (${durLabel}). They'll be notified.`);
    } catch (e) { Alert.alert("Error", "Could not ban the user."); }
  };

  const unbanUser = (userId) => {
    Alert.alert("Unban User", "Restore this user's access?", [
      { text: "Cancel", style: "cancel" },
      { text: "Unban", onPress: async () => {
        try {
          await updateDoc(doc(db, "users", userId), {
            role: "student", bannedUntil: null, banReason: null,
          });
          await loadUsers();
        } catch (e) { Alert.alert("Error", "Failed to unban."); }
      }},
    ]);
  };

  const deleteUser = async (userId, userName) => {
    Alert.alert(
      "Delete User",
      `Permanently delete ${userName}'s account and ALL of their data — listings, reviews, ratings, follows, cart, and notifications? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Everything", style: "destructive", onPress: async () => {
          // Runs on the server: deletes the person's login so they can no
          // longer sign in, and removes their data (see adminDeleteUser).
          try {
            await httpsCallable(functions, "adminDeleteUser")({ uid: userId });
            setUsers((prev) => prev.filter((u) => u.id !== userId));
            await loadListings();
            Alert.alert("Deleted", `${userName}'s account and data have been removed.`);
          } catch (e) {
            Alert.alert("Could not delete", e.message || "Please try again.");
          }
        }},
      ]
    );
  };

  const pendingCount = verifications.filter((v) => v.verificationStatus === "pending").length;
  const facultyPendingCount = facultyRequests.length;
  const verifyBadgeCount = pendingCount + facultyPendingCount;
  const pendingListingsCount = listings.filter((l) => l.status === "pending").length;
  const pendingAppealsCount = appeals.filter((a) => a.status === "pending").length;
  const pendingVerifications = verifications.filter((v) => v.verificationStatus === "pending");
  const completedVerifications = verifications.filter((v) => v.verificationStatus === "verified" || v.verificationStatus === "rejected");
  const displayedVerifications = verifySubTab === "pending" ? pendingVerifications : completedVerifications;

  const openReportsList = reports.filter((r) => r.status === "open");
  const reportGroups = Object.values(
    openReportsList.reduce((acc, r) => {
      const key = r.kind === "listing" ? `listing_${r.listingId || "unknown"}` : `user_${r.reportedUserId || "unknown"}`;
      if (!acc[key]) {
        acc[key] = {
          key, kind: r.kind,
          listingId: r.listingId, listingName: r.listingName,
          reportedUserId: r.reportedUserId, reportedUserName: r.reportedUserName,
          reports: [],
        };
      }
      acc[key].reports.push(r);
      return acc;
    }, {})
  );
  const resolvedReports = reports.filter((r) => r.status === "resolved" || r.status === "dismissed");
  const openGroupsCount = reportGroups.length;

  const pendingAppeals = appeals.filter((a) => a.status === "pending");
  const resolvedAppeals = appeals.filter((a) => a.status === "approved" || a.status === "rejected");

  if (loading) {
    return (
      <View style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={GREEN} size="large" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title="Admin Panel"
        subtitle="SLSU-GumaCart"
        onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Profile" }); }}
        right={
          <View style={styles.adminBadge}>
            <Ionicons name="key" size={18} color={GREEN} />
          </View>
        }
      />

      <View style={styles.statsCard}>
        <StatBox num={totals.users} label="Users" color="#EA580C" onPress={() => setActiveTab("users")} />
        <View style={styles.statDivider} />
        <StatBox num={pendingCount} label="Pending" color={AMBER} onPress={() => { setActiveTab("verifications"); setVerifySubTab("pending"); }} />
        <View style={styles.statDivider} />
        <StatBox num={totals.listings} label="Listings" color="#2563EB" onPress={() => setActiveTab("listings")} />
        <View style={styles.statDivider} />
        <StatBox num={verifications.filter((v) => v.verificationStatus === "verified").length} label="Verified" color={GREEN} onPress={() => setActiveTab("verifications")} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && { backgroundColor: tab.color + "1A" }]} activeOpacity={0.7} onPress={() => setActiveTab(tab.id)}>
            <View style={{ position: "relative" }}>
              <Ionicons name={activeTab === tab.id ? tab.icon : `${tab.icon}-outline`} size={21} color={activeTab === tab.id ? tab.color : COLORS.textMuted} />
              {tab.id === "verifications" && verifyBadgeCount > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{verifyBadgeCount}</Text></View>
              )}
              {tab.id === "listings" && pendingListingsCount > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{pendingListingsCount}</Text></View>
              )}
              {tab.id === "reports" && openGroupsCount > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{openGroupsCount}</Text></View>
              )}
              {tab.id === "appeals" && pendingAppealsCount > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{pendingAppealsCount}</Text></View>
              )}
            </View>
            <Text style={[styles.tabLabel, activeTab === tab.id && [styles.tabLabelActive, { color: tab.color }]]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>
      <ScrollView style={styles.bodyScroll} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}>

        {activeTab === "verifications" && (
          <View style={styles.tabContent}>
            <View style={styles.subTabs}>
              <TouchableOpacity style={[styles.subTab, verifySubTab === "pending" && styles.subTabActive]} activeOpacity={0.7} onPress={() => setVerifySubTab("pending")}>
                <Text style={[styles.subTabText, verifySubTab === "pending" && styles.subTabTextActive]}>
                  ⏳ Pending {pendingVerifications.length > 0 ? `(${pendingVerifications.length})` : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTab, verifySubTab === "faculty" && styles.subTabActive]} activeOpacity={0.7} onPress={() => setVerifySubTab("faculty")}>
                <Text style={[styles.subTabText, verifySubTab === "faculty" && styles.subTabTextActive]}>
                  Faculty {facultyRequests.length > 0 ? `(${facultyRequests.length})` : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTab, verifySubTab === "completed" && styles.subTabActive]} activeOpacity={0.7} onPress={() => setVerifySubTab("completed")}>
                <Text style={[styles.subTabText, verifySubTab === "completed" && styles.subTabTextActive]}>
                  ✓ Done {completedVerifications.length > 0 ? `(${completedVerifications.length})` : ""}
                </Text>
              </TouchableOpacity>
            </View>

            {verifySubTab === "faculty" ? (
              facultyRequests.length === 0 ? (
                <EmptyState icon="school-outline" text="No pending faculty requests" />
              ) : (
                facultyRequests.map((user) => (
                  <View key={user.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      {user.photoURL ? (
                        <Image source={{ uri: user.photoURL }} style={styles.cardAvatarImg} />
                      ) : (
                        <View style={styles.cardAvatar}>
                          <Text style={styles.cardAvatarText}>{user.name?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{user.name}</Text>
                        <Text style={styles.cardSub}>{user.email}</Text>
                        {user.verificationStatus === "verified" && (
                          <Text style={[styles.cardSub, { color: GREEN, fontWeight: "700", marginTop: 2 }]}>✓ Verified student</Text>
                        )}
                      </View>
                      <View style={[styles.typePill, { backgroundColor: "#C79A2E" }]}>
                        <Text style={styles.typePillText}>FACULTY</Text>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8} onPress={() => rejectFaculty(user.id, user.name)}>
                        <Ionicons name="close" size={15} color={RED} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} activeOpacity={0.85} onPress={() => approveFaculty(user.id, user.name)}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )
            ) : displayedVerifications.length === 0 ? (
              <EmptyState
                icon={verifySubTab === "pending" ? "hourglass-outline" : "checkmark-done-outline"}
                text={verifySubTab === "pending" ? "No pending verifications" : "No completed verifications yet"}
              />
            ) : (
              displayedVerifications.map((user) => (
                <View key={user.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardAvatar}>
                      <Text style={styles.cardAvatarText}>{user.name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{user.name}</Text>
                      <Text style={styles.cardSub}>{user.email}</Text>
                    </View>
                    <StatusBadge status={user.verificationStatus} />
                  </View>
                  {user.verification && (
                    <View style={styles.verifyDetails}>
                      <DetailRow label="School Email" value={user.verification.schoolEmail} />
                      <DetailRow label="Student ID" value={user.verification.studentId} />
                      {user.verification.idPhotoUrl && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.detailLabel}>Student ID Photo</Text>
                          <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerImage(user.verification.idPhotoUrl)}>
                            <Image source={{ uri: user.verification.idPhotoUrl }} style={styles.idPhoto} resizeMode="cover" />
                            <View style={styles.expandHint}>
                              <Ionicons name="expand" size={14} color="#fff" />
                              <Text style={styles.expandHintText}>Tap to enlarge</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                  {user.verificationStatus === "pending" && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8} onPress={() => openReject(user.id)}>
                        <Ionicons name="close" size={15} color={RED} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} activeOpacity={0.85} onPress={() => approveVerification(user.id)}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "listings" && (
          <View style={styles.tabContent}>
            <View style={styles.subTabRow}>
              {["pending", "approved"].map((st) => {
                const count = st === "pending" ? listings.length : activeListings.length;
                return (
                  <TouchableOpacity key={st} style={[styles.subTab, listingSubTab === st && styles.subTabActive]} activeOpacity={0.7} onPress={() => setListingSubTab(st)}>
                    <Text style={[styles.subTabText, listingSubTab === st && styles.subTabTextActive]}>
                      {st === "pending" ? `Pending (${count})` : `✓ Approved (${count})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {(() => {
              const shown = listingSubTab === "pending" ? listings : activeListings;
              if (shown.length === 0) {
                return <EmptyState icon={listingSubTab === "pending" ? "hourglass-outline" : "bag-handle-outline"} text={listingSubTab === "pending" ? "No listings awaiting approval" : "No approved listings"} />;
              }
              return shown.map((listing) => (
                <View key={listing.id} style={styles.card}>
                  <TouchableOpacity style={styles.cardHeader} activeOpacity={0.7} onPress={() => navigation.navigate("ProductDetail", { product: listing })}>
                    <View style={styles.listingImageBox}>
                      {listing.images?.[0] || listing.image ? (
                        <Image source={{ uri: listing.images?.[0] || listing.image }} style={styles.listingThumb} />
                      ) : (
                        <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName} numberOfLines={1}>{listing.name}</Text>
                      <Text style={styles.cardSub}>by {listing.sellerName}</Text>
                      <Text style={[styles.cardSub, { fontWeight: "700", color: GREEN, marginTop: 2 }]}>
                        {listing.type === "donate" ? "FREE" : listing.type === "barter" ? "For Barter" : `₱${listing.price?.toLocaleString()}`}
                      </Text>
                    </View>
                    <View style={[styles.typePill, { backgroundColor: listing.type === "donate" ? RED : listing.type === "barter" ? AMBER : listing.type === "buy" ? "#2980b9" : GREEN }]}>
                      <Text style={styles.typePillText}>{listing.type?.toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>

                  {listing.status === "pending" ? (
                    <View style={styles.approveRow}>
                      <TouchableOpacity style={styles.approveBtn} activeOpacity={0.85} onPress={() => approveListing(listing.id)}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.85} onPress={() => rejectListing(listing.id)}>
                        <Ionicons name="close" size={16} color={RED} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={() => deleteListing(listing.id)}>
                      <Ionicons name="trash-outline" size={15} color={RED} />
                      <Text style={styles.deleteBtnText}>Remove Listing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ));
            })()}
          </View>
        )}

        {activeTab === "reports" && (
          <View style={styles.tabContent}>
            <View style={styles.subTabRow}>
              <TouchableOpacity style={[styles.subTab, reportSubTab === "open" && styles.subTabActive]} activeOpacity={0.7} onPress={() => setReportSubTab("open")}>
                <Text style={[styles.subTabText, reportSubTab === "open" && styles.subTabTextActive]}>
                  Open {reportGroups.length > 0 ? `(${reportGroups.length})` : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTab, reportSubTab === "resolved" && styles.subTabActive]} activeOpacity={0.7} onPress={() => setReportSubTab("resolved")}>
                <Text style={[styles.subTabText, reportSubTab === "resolved" && styles.subTabTextActive]}>
                  ✓ Resolved {resolvedReports.length > 0 ? `(${resolvedReports.length})` : ""}
                </Text>
              </TouchableOpacity>
            </View>

            {reportSubTab === "open" ? (
              reportGroups.length === 0 ? (
                <EmptyState icon="flag-outline" text="No open reports" />
              ) : (
                reportGroups.map((group) => {
                  const targetName = group.kind === "listing" ? (group.listingName || "Listing") : (group.reportedUserName || "User");
                  const reasons = [...new Set(group.reports.map((r) => r.reason).filter(Boolean))];
                  const reporterNames = [...new Set(group.reports.map((r) => r.reporterName).filter(Boolean))];
                  const withProof = group.reports.find((r) => r.proofImageUrl);
                  const n = group.reports.length;
                  return (
                    <View key={group.key} style={styles.card}>
                      <TouchableOpacity style={styles.cardHeader} activeOpacity={0.7} onPress={() => openReportTarget(group.reports[0])}>
                        <View style={[styles.listingImageBox, { backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" }]}>
                          <Ionicons name="flag" size={22} color={RED} />
                        </View>
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardName} numberOfLines={1}>{targetName}</Text>
                          <Text style={styles.cardSub} numberOfLines={1}>
                            Reported by {reporterNames.slice(0, 2).join(", ") || "someone"}
                            {reporterNames.length > 2 ? ` +${reporterNames.length - 2} more` : ""}
                          </Text>
                          {reasons.slice(0, 2).map((reason, i) => (
                            <Text key={i} style={[styles.cardSub, { color: RED, fontWeight: "700", marginTop: 2 }]} numberOfLines={1}>• {reason}</Text>
                          ))}
                          {reasons.length > 2 && (
                            <Text style={[styles.cardSub, { marginTop: 2 }]}>+{reasons.length - 2} more reason(s)</Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <View style={[styles.typePill, { backgroundColor: group.kind === "listing" ? AMBER : "#9b59b6" }]}>
                            <Text style={styles.typePillText}>{group.kind === "listing" ? "LISTING" : "USER"}</Text>
                          </View>
                          {n > 1 && (
                            <View style={styles.countPill}><Text style={styles.countPillText}>{n}×</Text></View>
                          )}
                          <Ionicons name="chevron-forward" size={16} color="#CCC" style={{ marginTop: 6 }} />
                        </View>
                      </TouchableOpacity>

                      {withProof ? (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerImage(withProof.proofImageUrl)} style={{ marginBottom: 12 }}>
                          <Image source={{ uri: withProof.proofImageUrl }} style={styles.proofThumb} resizeMode="cover" />
                          <View style={styles.proofHint}>
                            <Ionicons name="expand" size={12} color="#fff" />
                            <Text style={styles.proofHintText}>Proof — tap to enlarge</Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}

                      <View style={styles.approveRow}>
                        {group.kind === "listing" && group.listingId ? (
                          <TouchableOpacity style={styles.deleteUserBtn} activeOpacity={0.85} onPress={() => removeReportedListingGroup(group)}>
                            <Ionicons name="trash-outline" size={15} color="#fff" />
                            <Text style={styles.deleteUserBtnText}>Remove Listing</Text>
                          </TouchableOpacity>
                        ) : null}
                        {group.kind === "user" && group.reportedUserId ? (
                          <TouchableOpacity style={styles.deleteUserBtn} activeOpacity={0.85} onPress={() => openBan(group.reportedUserId, group.reportedUserName, group)}>
                            <Ionicons name="ban" size={15} color="#fff" />
                            <Text style={styles.deleteUserBtnText}>Ban User</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.dismissBtn} activeOpacity={0.8} onPress={() => dismissReportGroup(group)}>
                          <Ionicons name="checkmark" size={15} color="#666" />
                          <Text style={styles.dismissBtnText}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )
            ) : (
              resolvedReports.length === 0 ? (
                <EmptyState icon="checkmark-done-outline" text="No resolved reports yet" />
              ) : (
                resolvedReports.map((report) => (
                  <View key={report.id} style={styles.card}>
                    <TouchableOpacity style={[styles.cardHeader, { marginBottom: report.proofImageUrl ? 10 : 0 }]} activeOpacity={0.7} onPress={() => openReportTarget(report)}>
                      <View style={[styles.listingImageBox, { backgroundColor: "#F2F2F2", alignItems: "center", justifyContent: "center" }]}>
                        <Ionicons name="flag-outline" size={22} color="#999" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {report.kind === "listing" ? (report.listingName || "Listing") : (report.reportedUserName || "User")}
                        </Text>
                        <Text style={styles.cardSub} numberOfLines={1}>Reported by {report.reporterName || "someone"}</Text>
                        <Text style={[styles.cardSub, { marginTop: 2 }]} numberOfLines={1}>{report.reason}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: report.status === "resolved" ? "#E8F4EC" : "#F2F2F2" }]}>
                        <Text style={[styles.statusBadgeText, { color: report.status === "resolved" ? GREEN : "#999" }]}>
                          {report.status === "resolved" ? "✓ Resolved" : "○ Dismissed"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {report.proofImageUrl ? (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerImage(report.proofImageUrl)}>
                        <Image source={{ uri: report.proofImageUrl }} style={styles.proofThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )
            )}
          </View>
        )}

        {activeTab === "appeals" && (
          <View style={styles.tabContent}>
            {pendingAppeals.length === 0 && resolvedAppeals.length === 0 ? (
              <EmptyState icon="mail-open-outline" text="No appeals" />
            ) : (
              <>
                {pendingAppeals.length > 0 && (
                  <Text style={styles.groupHeading}>Pending ({pendingAppeals.length})</Text>
                )}
                {pendingAppeals.map((appeal) => (
                  <View key={appeal.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.cardAvatar, { backgroundColor: RED }]}>
                        <Ionicons name="ban" size={20} color="#fff" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{appeal.userName || "User"}</Text>
                        <Text style={styles.cardSub}>{appeal.userEmail}</Text>
                        {appeal.banReason ? (
                          <Text style={[styles.cardSub, { color: RED, marginTop: 2 }]} numberOfLines={1}>Banned for: {appeal.banReason}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.typePill, { backgroundColor: RED }]}>
                        <Text style={styles.typePillText}>BANNED</Text>
                      </View>
                    </View>

                    {appeal.message ? (
                      <View style={styles.appealMsgBox}>
                        <Text style={styles.appealMsgLabel}>Appeal message</Text>
                        <Text style={styles.appealMsgText}>{appeal.message}</Text>
                      </View>
                    ) : null}

                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8} onPress={() => rejectAppeal(appeal)}>
                        <Ionicons name="close" size={15} color={RED} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} activeOpacity={0.85} onPress={() => approveAppeal(appeal)}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                        <Text style={styles.approveBtnText}>Unban</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {resolvedAppeals.length > 0 && (
                  <Text style={[styles.groupHeading, { marginTop: 8 }]}>Resolved ({resolvedAppeals.length})</Text>
                )}
                {resolvedAppeals.map((appeal) => (
                  <View key={appeal.id} style={styles.card}>
                    <View style={[styles.cardHeader, { marginBottom: appeal.message ? 12 : 0 }]}>
                      <View style={[styles.cardAvatar, { backgroundColor: appeal.status === "approved" ? GREEN : "#999" }]}>
                        <Ionicons name={appeal.status === "approved" ? "checkmark" : "close"} size={20} color="#fff" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{appeal.userName || "User"}</Text>
                        <Text style={styles.cardSub}>{appeal.userEmail}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: appeal.status === "approved" ? "#E8F4EC" : "#F2F2F2" }]}>
                        <Text style={[styles.statusBadgeText, { color: appeal.status === "approved" ? GREEN : "#999" }]}>
                          {appeal.status === "approved" ? "✓ Restored" : "✕ Declined"}
                        </Text>
                      </View>
                    </View>
                    {appeal.message ? (
                      <View style={styles.appealMsgBox}>
                        <Text style={styles.appealMsgText} numberOfLines={3}>{appeal.message}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === "users" && (
          <View style={styles.tabContent}>
            {users.length === 0 ? (loadingUsers ? null : <EmptyState icon="people-outline" text="No users yet" />) : (
              users.map((u) => (
                <View key={u.id} style={styles.card}>
                  <TouchableOpacity style={styles.cardHeader} activeOpacity={0.7} onPress={() => navigation.navigate("SellerProfile", { sellerId: u.id, sellerName: u.name || "User" })}>
                    {u.photoURL ? (
                      <TouchableOpacity activeOpacity={0.8} onPress={() => setViewerImage(u.photoURL)}>
                        <Image source={{ uri: u.photoURL }} style={styles.cardAvatarImg} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{u.name?.[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{u.name}</Text>
                      <Text style={styles.cardSub}>{u.email}</Text>
                      <Text style={styles.cardSub}>Role: {u.role || "student"}</Text>
                      {u.role === "banned" && u.banReason ? (
                        <Text style={[styles.cardSub, { color: RED, marginTop: 2 }]} numberOfLines={1}>Reason: {u.banReason}</Text>
                      ) : null}
                    </View>
                    <StatusBadge status={u.verificationStatus || "unverified"} />
                  </TouchableOpacity>
                  {u.id !== auth.currentUser.uid && (
                    <View style={styles.userActionsRow}>
                      <TouchableOpacity style={[styles.banBtn, u.role === "banned" && styles.unbanBtn]} activeOpacity={0.8} onPress={() => u.role === "banned" ? unbanUser(u.id) : openBan(u.id, u.name)}>
                        <Text style={[styles.banBtnText, u.role === "banned" && { color: GREEN }]}>{u.role === "banned" ? "Unban" : "Ban"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteUserBtn} activeOpacity={0.85} onPress={() => deleteUser(u.id, u.name)}>
                        <Ionicons name="trash-outline" size={14} color="#fff" />
                        <Text style={styles.deleteUserBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
            {loadingUsers && <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />}
            {!loadingUsers && hasMoreUsers && (
              <TouchableOpacity style={styles.loadMoreBtn} activeOpacity={0.8} onPress={() => loadUsers(true)}>
                <Text style={styles.loadMoreText}>Load more users</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      </View>

      <Modal visible={rejectVisible} transparent animationType="fade" onRequestClose={() => { setRejectVisible(false); setPendingReason(null); }}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => { setRejectVisible(false); setPendingReason(null); }}>
          <TouchableOpacity style={styles.reportSheet} activeOpacity={1}>
            <View style={styles.reportHandle} />
            <Text style={styles.reportTitle}>Reject Verification</Text>
            <Text style={styles.reportSub}>
              {pendingReason ? "The student will be notified and can re-submit." : "Select the reason for rejection:"}
            </Text>
            {!pendingReason ? (
              <>
                {REJECT_REASONS.map((reason) => (
                  <TouchableOpacity key={reason} style={styles.reasonRow} activeOpacity={0.7} onPress={() => setPendingReason(reason)}>
                    <Ionicons name="alert-circle-outline" size={18} color="#666" style={{ marginRight: 12 }} />
                    <Text style={styles.reasonText}>{reason}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={() => { setRejectVisible(false); setPendingReason(null); }}>
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.reasonSelected}>
                  <Ionicons name="alert-circle" size={18} color="#e74c3c" style={{ marginRight: 10 }} />
                  <Text style={styles.reasonSelectedText}>{pendingReason}</Text>
                </View>
                <TouchableOpacity style={styles.reportSubmit} activeOpacity={0.85} onPress={submitReject}>
                  <Text style={styles.reportSubmitText}>Reject Verification</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={() => setPendingReason(null)}>
                  <Text style={styles.reportCancelText}>Go Back</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={banVisible} transparent animationType="fade" onRequestClose={() => setBanVisible(false)}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => setBanVisible(false)}>
          <TouchableOpacity style={styles.reportSheet} activeOpacity={1}>
            <View style={styles.reportHandle} />
            <Text style={styles.reportTitle}>Suspend {banUserName}</Text>
            <Text style={styles.reportSub}>
              {!banReason ? "Step 1 — choose a reason:" : !banDuration ? "Step 2 — choose a duration:" : "Confirm the suspension:"}
            </Text>

            {!banReason ? (
              <>
                {BAN_REASONS.map((reason) => (
                  <TouchableOpacity key={reason} style={styles.reasonRow} activeOpacity={0.7} onPress={() => setBanReason(reason)}>
                    <Ionicons name="alert-circle-outline" size={18} color="#666" style={{ marginRight: 12 }} />
                    <Text style={styles.reasonText}>{reason}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={() => setBanVisible(false)}>
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : !banDuration ? (
              <>
                <View style={styles.reasonSelected}>
                  <Ionicons name="alert-circle" size={18} color={RED} style={{ marginRight: 10 }} />
                  <Text style={styles.reasonSelectedText}>{banReason}</Text>
                </View>
                {BAN_DURATIONS.map((d) => (
                  <TouchableOpacity key={d.key} style={styles.reasonRow} activeOpacity={0.7} onPress={() => setBanDuration(d.key)}>
                    <Ionicons name={d.key === "permanent" ? "ban" : "time-outline"} size={18} color={d.key === "permanent" ? RED : "#666"} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reasonText}>{d.label}</Text>
                      <Text style={{ fontSize: 12, color: "#999", marginTop: 1 }}>{d.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={() => setBanReason(null)}>
                  <Text style={styles.reportCancelText}>Go Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.reasonSelected}>
                  <Ionicons name="alert-circle" size={18} color={RED} style={{ marginRight: 10 }} />
                  <Text style={styles.reasonSelectedText}>{banReason}</Text>
                </View>
                <View style={[styles.reasonSelected, { backgroundColor: "#FEF5E7" }]}>
                  <Ionicons name="time" size={18} color="#B9770E" style={{ marginRight: 10 }} />
                  <Text style={[styles.reasonSelectedText, { color: "#B9770E" }]}>
                    {BAN_DURATIONS.find((d) => d.key === banDuration)?.label}
                  </Text>
                </View>
                <TouchableOpacity style={styles.reportSubmit} activeOpacity={0.85} onPress={submitBan}>
                  <Text style={styles.reportSubmitText}>Suspend User</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportCancel} activeOpacity={0.7} onPress={() => setBanDuration(null)}>
                  <Text style={styles.reportCancelText}>Go Back</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!viewerImage} transparent animationType="fade" onRequestClose={() => setViewerImage(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} activeOpacity={0.8} onPress={() => setViewerImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.viewerBackdrop} activeOpacity={1} onPress={() => setViewerImage(null)}>
            {viewerImage && (
              <Image source={{ uri: viewerImage }} style={styles.viewerImage} resizeMode="contain" />
            )}
          </TouchableOpacity>
          <Text style={styles.viewerHint}>Tap anywhere to close</Text>
        </View>
      </Modal>
    </View>
  );
}

function StatBox({ num, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.statBox} activeOpacity={0.6} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.statNum, { color }]}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ status }) {
  const config = {
    pending:    { color: AMBER, bg: "#FFF3E0", label: "⏳ Pending" },
    verified:   { color: GREEN, bg: "#E8F4EC", label: "✓ Verified" },
    rejected:   { color: RED,   bg: "#FDECEA", label: "✕ Rejected" },
    unverified: { color: "#999", bg: "#F2F2F2", label: "○ Unverified" },
    banned:     { color: RED,   bg: "#FDECEA", label: "Banned" },
  };
  const c = config[status] || config.unverified;
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function EmptyState({ icon, text }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Ionicons name={icon} size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT_BG },
  body: { flex: 1, backgroundColor: LIGHT_BG },
  bodyScroll: { flex: 1, backgroundColor: LIGHT_BG },
  loadingText: { marginTop: 14, fontSize: 13, color: COLORS.textMuted, fontWeight: "500" },
  adminBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginRight: 4 },
  statsCard: { flexDirection: "row", backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 12, borderRadius: 18, paddingVertical: 16, ...SHADOWS.sm },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontFamily: FONTS.heading },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, fontWeight: "500" },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  tabs: { flexDirection: "row", backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 12, borderRadius: RADIUS.lg, padding: 4, ...SHADOWS.sm },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.primaryPale },
  tabIcon: { fontSize: 18, marginBottom: 3 },
  tabLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  tabLabelActive: { color: GREEN, fontFamily: FONTS.heading },
  tabBadge: { position: "absolute", top: -4, right: -10, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  tabContent: { padding: 18 },
  loadMoreBtn: { alignSelf: "center", marginTop: 6, marginBottom: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.primaryPale },
  loadMoreText: { fontSize: 13.5, fontWeight: "700", color: GREEN },
  groupHeading: { fontSize: 13, fontFamily: FONTS.heading, color: "#666", marginBottom: 10, marginLeft: 2 },
  subTabs: { flexDirection: "row", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3, marginBottom: 16 },
  subTabRow: { flexDirection: "row", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 3, marginBottom: 16 },
  approveRow: { flexDirection: "row", gap: 10 },
  subTab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: RADIUS.full },
  subTabActive: { backgroundColor: GREEN },
  subTabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  subTabTextActive: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: COLORS.white, borderRadius: 18, padding: 16, marginBottom: 12, ...SHADOWS.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardAvatarImg: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  cardAvatarText: { fontSize: 18, fontFamily: FONTS.heading, color: "#fff" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 2 },
  cardSub: { fontSize: 12, color: COLORS.textMuted },
  listingImageBox: { width: 54, height: 54, borderRadius: 12, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", marginRight: 12, overflow: "hidden" },
  listingThumb: { width: 54, height: 54, resizeMode: "cover" },
  listingThumbPlaceholder: { fontSize: 24 },
  typePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  typePillText: { color: "#fff", fontSize: 9, fontFamily: FONTS.heading },
  countPill: { marginTop: 6, backgroundColor: RED, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  countPillText: { color: "#fff", fontSize: 10, fontFamily: FONTS.heading },
  proofThumb: { width: "100%", height: 160, borderRadius: 12, borderWidth: 1, borderColor: "#EAEAEA", backgroundColor: "#F5F5F5" },
  proofHint: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  proofHintText: { color: "#fff", fontSize: 11, fontWeight: "600", marginLeft: 4 },
  appealMsgBox: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 12, marginBottom: 12 },
  appealMsgLabel: { fontSize: 11, color: "#999", fontWeight: "700", marginBottom: 4 },
  appealMsgText: { fontSize: 13.5, color: "#333", lineHeight: 19 },
  verifyDetails: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 14, marginBottom: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  detailLabel: { fontSize: 12, color: "#999", fontWeight: "600" },
  detailValue: { fontSize: 12, color: "#333", flex: 1, textAlign: "right", fontWeight: "500" },
  idPhoto: { width: "100%", height: 170, borderRadius: 12, marginTop: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  cardActions: { flexDirection: "row", gap: 10 },
  rejectBtn: { flex: 1, flexDirection: "row", gap: 5, height: 44, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: RED, alignItems: "center", justifyContent: "center" },
  rejectBtnText: { fontSize: 13, fontWeight: "700", color: RED },
  approveBtn: { flex: 1, flexDirection: "row", gap: 5, height: 44, borderRadius: RADIUS.md, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  approveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  deleteBtn: { flexDirection: "row", gap: 6, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: RED, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { fontSize: 13, fontWeight: "700", color: RED },
  dismissBtn: { flex: 1, flexDirection: "row", gap: 5, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: "#CBCBCB", alignItems: "center", justifyContent: "center" },
  dismissBtnText: { fontSize: 13, fontWeight: "700", color: "#666" },
  unbanBtn: { borderColor: GREEN },
  userActionsRow: { flexDirection: "row", gap: 10 },
  banBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: RED, alignItems: "center", justifyContent: "center" },
  banBtnText: { fontSize: 13, fontWeight: "700", color: RED },
  deleteUserBtn: { flex: 1, flexDirection: "row", gap: 5, height: 44, borderRadius: 12, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  deleteUserBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyIcon: { fontSize: 38 },
  emptyText: { fontSize: 14, color: "#999" },

  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  reportSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  reportHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#DDD", marginBottom: 16 },
  reportTitle: { fontSize: 19, fontFamily: FONTS.heading, color: "#111", marginBottom: 4 },
  reportSub: { fontSize: 13.5, color: "#777", marginBottom: 16 },
  reasonRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F2F2F2" },
  reasonText: { flex: 1, fontSize: 14.5, color: "#222", fontWeight: "500" },
  reasonSelected: { flexDirection: "row", alignItems: "center", backgroundColor: "#FDECEA", borderRadius: 12, padding: 14, marginBottom: 12 },
  reasonSelectedText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#c0392b" },
  reportSubmit: { height: 52, borderRadius: 14, backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center", marginTop: 6 },
  reportSubmitText: { fontSize: 15, fontFamily: FONTS.heading, color: "#fff" },
  reportCancel: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  reportCancelText: { fontSize: 15, fontWeight: "700", color: "#666" },

  expandHint: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  expandHintText: { color: "#fff", fontSize: 11, fontWeight: "600", marginLeft: 4 },
  viewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  viewerBackdrop: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  viewerImage: { width: "92%", height: "80%" },
  viewerClose: { position: "absolute", top: 44, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  viewerHint: { position: "absolute", bottom: 40, color: "rgba(255,255,255,0.6)", fontSize: 13 },
});
