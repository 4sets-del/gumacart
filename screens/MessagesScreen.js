import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator, Alert, Image, RefreshControl, Platform,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import {
  collection, query, where, onSnapshot, orderBy,
  doc, getDoc, deleteDoc, getDocs, updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const LIGHT_BG = "#F0F4ED";

function timeAgo(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((new Date() - d) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageTime", "desc"),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const convos = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const otherId = data.participants.find((id) => id !== user.uid);
            const unread = data.unreadCount?.[user.uid] || 0;
            let otherUserName = "Unknown";
            let otherUserPhoto = null;
            try {
              const otherUserDoc = await getDoc(doc(db, "users", otherId));
              if (otherUserDoc.exists()) {
                otherUserName = otherUserDoc.data()?.name || "Unknown";
                otherUserPhoto = otherUserDoc.data()?.photoURL || null;
              }
            } catch (e) {}
            return {
              id: docSnap.id, otherUserName, otherUserPhoto, otherUserId: otherId,
              lastMessage: data.lastMessage || "", lastMessageTime: data.lastMessageTime,
              unread, listingName: data.listingName || "",
            };
          }),
        );
        setConversations(convos);
      } catch (e) {
        console.log("Conversations error:", e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, () => { setLoading(false); setRefreshing(false); });

    return unsubscribe;
  }, []);

  const openChat = async (convo) => {
    // Optimistically clear unread in local state so the card updates instantly
    if (convo.unread > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convo.id ? { ...c, unread: 0 } : c))
      );
    }
    navigation.navigate("Chat", {
      conversationId: convo.id,
      otherUserId: convo.otherUserId,
      otherUserName: convo.otherUserName,
      listingName: convo.listingName,
    });
    // Then persist to Firestore in the background
    if (convo.unread > 0) {
      try {
        await updateDoc(doc(db, "conversations", convo.id), {
          [`unreadCount.${user.uid}`]: 0,
        });
      } catch (e) {}
    }
  };

  const deleteConversation = async (convoId) => {
    Alert.alert("Delete Conversation", "Delete this entire conversation? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const msgsSnap = await getDocs(collection(db, "conversations", convoId, "messages"));
          await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
          await deleteDoc(doc(db, "conversations", convoId));
        } catch (e) { Alert.alert("Error", "Failed to delete conversation."); }
      }},
    ]);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Home"); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && <Text style={styles.unreadCount}>{totalUnread} unread</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={GREEN} size="large" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ backgroundColor: LIGHT_BG }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} colors={[GREEN]} />}
        >
          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="chatbubbles-outline" size={44} color={GREEN} />
              </View>
              <Text style={styles.emptyTitle}>No Messages Yet</Text>
              <Text style={styles.emptySub}>
                When you message a seller or someone messages you, it will appear here.
              </Text>
              <TouchableOpacity style={styles.browseBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Home")}>
                <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.browseBtnText}>Browse Listings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {conversations.map((convo) => {
                const isUnread = convo.unread > 0;
                const previewText = convo.lastMessage
                  ? convo.lastMessage.length > 40
                    ? convo.lastMessage.substring(0, 40) + "..."
                    : convo.lastMessage
                  : "Start a conversation";

                return (
                  <TouchableOpacity
                    key={convo.id}
                    style={[styles.convoCard, isUnread && styles.convoCardUnread]}
                    onPress={() => openChat(convo)}
                    onLongPress={() => deleteConversation(convo.id)}
                    delayLongPress={400}
                    activeOpacity={0.85}
                  >
                    <View style={styles.avatarWrapper}>
                      {convo.otherUserPhoto ? (
                        <Image source={{ uri: convo.otherUserPhoto }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{convo.otherUserName?.[0]?.toUpperCase() || "?"}</Text>
                        </View>
                      )}
                      {isUnread && <View style={styles.onlineDot} />}
                    </View>

                    <View style={styles.convoContent}>
                      <View style={styles.convoTopRow}>
                        <Text style={[styles.convoName, isUnread && styles.convoNameUnread]} numberOfLines={1}>
                          {convo.otherUserName}
                        </Text>
                        <Text style={[styles.convoTime, isUnread && styles.convoTimeUnread]}>
                          {timeAgo(convo.lastMessageTime)}
                        </Text>
                      </View>

                      {convo.listingName ? (
                        <Text style={styles.convoListing} numberOfLines={1}>🛍️ {convo.listingName}</Text>
                      ) : null}

                      <View style={styles.convoBottomRow}>
                        <Text
                          style={[styles.convoPreview, isUnread && styles.convoPreviewUnread]}
                          numberOfLines={1}
                        >
                          {previewText}
                        </Text>
                        {isUnread && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {convo.unread > 9 ? "9+" : convo.unread}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: GREEN },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  unreadCount: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600", marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 13, color: "#999", fontWeight: "500" },

  list: { paddingHorizontal: 16, paddingTop: 10 },

  convoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#EAEAEA", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  convoCardUnread: { backgroundColor: "#F5FAF6", borderColor: "#D0E8D8" },

  avatarWrapper: { position: "relative", marginRight: 12 },
  avatarCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: GREEN, borderWidth: 2, borderColor: "#fff" },

  convoContent: { flex: 1 },
  convoTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  convoName: { fontSize: 15, fontWeight: "600", color: "#555", flex: 1, marginRight: 8 },
  convoNameUnread: { fontWeight: "800", color: "#111" },
  convoTime: { fontSize: 11, color: "#bbb" },
  convoTimeUnread: { color: GREEN, fontWeight: "700" },
  convoListing: { fontSize: 11, color: GREEN, marginBottom: 3, fontWeight: "500" },

  convoBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convoPreview: { fontSize: 13, color: "#aaa", flex: 1 },
  convoPreviewUnread: { color: "#333", fontWeight: "600" },

  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginLeft: 8 },
  unreadBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  emptyState: { alignItems: "center", paddingVertical: 90, paddingHorizontal: 40 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#E8F5EC", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#333", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 16, paddingHorizontal: 26, paddingVertical: 14, elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  browseBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
