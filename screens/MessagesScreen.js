import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { useIsFocused } from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";
import { getUserBasics } from "../utils/userCache";
import { Image as CachedImage } from "expo-image";
import { COLORS, colorForName, FONTS } from "../constants/theme";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = COLORS.primary;
const LIGHT_BG = COLORS.white;

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
  const isFocused = useIsFocused();
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
            // "estimate" so a just-written clearedAt doesn't read as null and flash back.
            const data = docSnap.data({ serverTimestamps: "estimate" });
            // Hidden if this user deleted it and nothing new arrived since.
            const clearedAt = data.clearedAt?.[user.uid];
            if (clearedAt?.toMillis && (!data.lastMessageTime?.toMillis || data.lastMessageTime.toMillis() <= clearedAt.toMillis())) {
              return null;
            }
            const otherId = data.participants.find((id) => id !== user.uid);
            const unread = data.unreadCount?.[user.uid] || 0;
            const { name: otherUserName, photoURL: otherUserPhoto } = await getUserBasics(otherId);
            return {
              id: docSnap.id, otherUserName, otherUserPhoto, otherUserId: otherId,
              lastMessage: data.lastMessage || "", lastMessageTime: data.lastMessageTime,
              unread, listingName: data.listingName || "",
            };
          }),
        );
        setConversations(convos.filter(Boolean));
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

  // Deleting only hides the conversation for this user: everything before
  // now is hidden for them, while the other person keeps their history. If
  // a new message arrives later, the chat reappears with just the new part.
  const deleteConversation = async (convoId) => {
    Alert.alert("Delete Conversation", "Remove this conversation from your inbox? The other person will still see it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setConversations((prev) => prev.filter((c) => c.id !== convoId));
        try {
          await updateDoc(doc(db, "conversations", convoId), {
            [`clearedAt.${user.uid}`]: serverTimestamp(),
            [`unreadCount.${user.uid}`]: 0,
          });
        } catch (e) { Alert.alert("Error", "Failed to delete conversation."); }
      }},
    ]);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      {isFocused && <StatusBar barStyle="dark-content" />}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 && <Text style={styles.unreadCount}>{totalUnread} unread</Text>}
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
              <TouchableOpacity style={styles.browseBtn} activeOpacity={0.85} onPress={() => navigation.navigate("Main", { screen: "Home" })}>
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
                        <CachedImage source={{ uri: convo.otherUserPhoto }} style={styles.avatarImage} cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.avatarCircle, { backgroundColor: colorForName(convo.otherUserName) }]}>
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
  safe: { flex: 1, backgroundColor: COLORS.white, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  headerTitle: { fontSize: 24, fontFamily: FONTS.heading, color: COLORS.textPrimary, letterSpacing: -0.4 },
  unreadCount: { fontSize: 12.5, color: COLORS.primary, fontWeight: "700" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 13, color: "#999", fontWeight: "500" },

  list: { paddingHorizontal: 16, paddingTop: 10 },

  convoCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  convoCardUnread: {},

  avatarWrapper: { position: "relative", marginRight: 12 },
  avatarCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  avatarText: { fontSize: 22, fontFamily: FONTS.heading, color: "#fff" },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: GREEN, borderWidth: 2, borderColor: "#fff" },

  convoContent: { flex: 1 },
  convoTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  convoName: { fontSize: 15, fontWeight: "600", color: "#555", flex: 1, marginRight: 8 },
  convoNameUnread: { fontFamily: FONTS.heading, color: "#111" },
  convoTime: { fontSize: 11, color: "#bbb" },
  convoTimeUnread: { color: GREEN, fontWeight: "700" },
  convoListing: { fontSize: 11, color: GREEN, marginBottom: 3, fontWeight: "500" },

  convoBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convoPreview: { fontSize: 13, color: "#aaa", flex: 1 },
  convoPreviewUnread: { color: "#333", fontWeight: "600" },

  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginLeft: 8 },
  unreadBadgeText: { color: "#fff", fontSize: 10, fontFamily: FONTS.heading },

  emptyState: { alignItems: "center", paddingVertical: 90, paddingHorizontal: 40 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.heading, color: "#333", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  browseBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 16, paddingHorizontal: 26, paddingVertical: 14, elevation: 3, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  browseBtnText: { color: "#fff", fontFamily: FONTS.heading, fontSize: 15 },
});
