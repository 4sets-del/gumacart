import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform,
  StatusBar, TextInput, KeyboardAvoidingView, Image, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from "@expo/vector-icons";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, doc, updateDoc, increment, deleteDoc, getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = "#2E6B3E";
const GREEN_LIGHT = "#E8F5EC";
const BG = "#F0F4ED";
const LIGHT_BG = "#F0F4ED";

// Emoji users can react with
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function timeLabel(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen({ route, navigation }) {
  const { conversationId, otherUserId, otherUserName, listingName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [otherUserPhoto, setOtherUserPhoto] = useState(null);
  const scrollRef = useRef(null);
  const user = auth.currentUser;

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerMedia, setViewerMedia] = useState(null);
  const [viewerType, setViewerType] = useState(null);

  // Reply + reactions
  const insets = useSafeAreaInsets();
  const [replyTo, setReplyTo] = useState(null);       // message being replied to
  const [actionMsg, setActionMsg] = useState(null);   // message long-pressed (opens action sheet)

  // Video player for the fullscreen viewer
  const videoPlayer = useVideoPlayer(viewerType === "video" ? viewerMedia : null, (p) => {
    if (p) { p.loop = false; }
  });

  // Close the media viewer and STOP playback (otherwise audio keeps playing)
  const closeViewer = () => {
    try {
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
      }
    } catch (e) {}
    setViewerVisible(false);
    setViewerMedia(null);
    setViewerType(null);
  };

  useEffect(() => {
    const fetchOtherUserPhoto = async () => {
      try {
        const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
        if (otherUserDoc.exists()) setOtherUserPhoto(otherUserDoc.data()?.photoURL || null);
      } catch (e) {}
    };
    if (otherUserId) fetchOtherUserPhoto();
  }, [otherUserId]);

  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsubscribe;
  }, [conversationId]);

  // Safety net: whenever the viewer is hidden, make sure playback stops.
  useEffect(() => {
    if (!viewerVisible && videoPlayer) {
      try { videoPlayer.pause(); } catch (e) {}
    }
  }, [viewerVisible]);

  const sendMessage = async (msgData) => {
    if (!msgData.text?.trim() && !msgData.mediaUrl) return;
    setSending(true);
    try {
      const convoRef = doc(db, "conversations", conversationId);

      // Attach reply context if the user is replying
      const replyPayload = replyTo ? {
        replyTo: {
          id: replyTo.id,
          text: replyTo.text || (replyTo.type === "image" ? "📷 Photo" : replyTo.type === "video" ? "🎥 Video" : ""),
          senderName: replyTo.senderName || "",
          type: replyTo.type || "text",
        },
      } : {};

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        senderName: user.displayName,
        ...msgData,
        ...replyPayload,
        reactions: {},
        createdAt: serverTimestamp(),
      });
      await updateDoc(convoRef, {
        lastMessage: msgData.text || (msgData.type === "image" ? "📷 Photo" : "🎥 Video"),
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherUserId}`]: increment(1),
      });
      setText("");
      setReplyTo(null);
    } catch (e) {
      Alert.alert("Error", "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Toggle an emoji reaction on a message. Stored as reactions: { "👍": [uid1, uid2] }
  const toggleReaction = async (msg, emoji) => {
    try {
      const msgRef = doc(db, "conversations", conversationId, "messages", msg.id);
      const current = msg.reactions || {};
      const usersForEmoji = Array.isArray(current[emoji]) ? [...current[emoji]] : [];
      const idx = usersForEmoji.indexOf(user.uid);

      if (idx >= 0) usersForEmoji.splice(idx, 1);  // remove my reaction
      else usersForEmoji.push(user.uid);            // add my reaction

      const next = { ...current };
      if (usersForEmoji.length === 0) delete next[emoji];
      else next[emoji] = usersForEmoji;

      await updateDoc(msgRef, { reactions: next });
    } catch (e) {
      Alert.alert("Error", "Could not react to message.");
    } finally {
      setActionMsg(null);
    }
  };

  const handleSendText = () => {
    if (!text.trim()) return;
    sendMessage({ text: text.trim(), type: "text" });
  };

  const pickMedia = async (type) => {
    const permission = type === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed"); return; }

    const result = type === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
    if (result.canceled) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    setUploadingMedia(true);
    try {
      const filename = `chats/${conversationId}/${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
      const storageRef = ref(storage, filename);
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("Network request failed"));
        xhr.responseType = "blob";
        xhr.open("GET", asset.uri, true);
        xhr.send(null);
      });
      await uploadBytes(storageRef, blob);
      const mediaUrl = await getDownloadURL(storageRef);
      await sendMessage({ text: "", type: isVideo ? "video" : "image", mediaUrl });
    } catch (e) {
      Alert.alert("Error", "Failed to upload media.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const showMediaOptions = () => {
    Alert.alert("Send Media", "Choose an option", [
      { text: "📷 Take Photo/Video", onPress: () => pickMedia("camera") },
      { text: "🖼️ Choose from Gallery", onPress: () => pickMedia("gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const deleteMessage = async (msg) => {
    setActionMsg(null);
    if (msg.senderId !== user.uid) {
      Alert.alert("Cannot delete", "You can only delete your own messages.");
      return;
    }
    Alert.alert("Delete Message", "This will delete the message for everyone in this chat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete for Everyone", style: "destructive",
        onPress: async () => {
          try {
            if (msg.mediaUrl) {
              try { await deleteObject(ref(storage, msg.mediaUrl)); } catch (e) {}
            }
            await deleteDoc(doc(db, "conversations", conversationId, "messages", msg.id));
          } catch (e) { Alert.alert("Error", "Failed to delete message."); }
        },
      },
    ]);
  };

  const groupedMessages = () => {
    const groups = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const d = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
      const dateStr = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      if (dateStr !== lastDate) {
        groups.push({ type: "date", label: dateStr, id: "date_" + dateStr });
        lastDate = dateStr;
      }
      groups.push({ type: "message", ...msg });
    });
    return groups;
  };

  const renderAvatar = (small = true) => {
    const size = small ? 32 : 42;
    if (otherUserPhoto) {
      return <Image source={{ uri: otherUserPhoto }} style={{ width: size, height: size, borderRadius: size / 2, marginRight: small ? 8 : 10 }} />;
    }
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginRight: small ? 8 : 10 }}>
        <Text style={{ fontSize: size * 0.4, fontWeight: "700", color: "#fff" }}>{otherUserName?.[0]?.toUpperCase()}</Text>
      </View>
    );
  };

  const renderMessage = (msg) => {
    const isMe = msg.senderId === user.uid;
    const reactionEntries = Object.entries(msg.reactions || {}).filter(([, uids]) => uids?.length);

    return (
      <View key={msg.id} style={{ marginBottom: 6 }}>
        <TouchableOpacity
          onLongPress={() => setActionMsg(msg)}
          delayLongPress={350}
          activeOpacity={0.85}
          style={[styles.msgRow, isMe && styles.msgRowMe]}
        >
          {!isMe && renderAvatar(true)}
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>

            {/* Reply preview inside the bubble */}
            {msg.replyTo ? (
              <View style={[styles.replyPreview, isMe && styles.replyPreviewMe]}>
                <Text style={[styles.replyName, isMe && { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
                  {msg.replyTo.senderName || "Message"}
                </Text>
                <Text style={[styles.replySnippet, isMe && { color: "rgba(255,255,255,0.7)" }]} numberOfLines={1}>
                  {msg.replyTo.text || "Attachment"}
                </Text>
              </View>
            ) : null}

            {msg.type === "image" && msg.mediaUrl ? (
              <TouchableOpacity onPress={() => { setViewerMedia(msg.mediaUrl); setViewerType("image"); setViewerVisible(true); }}>
                <Image source={{ uri: msg.mediaUrl }} style={styles.msgImage} resizeMode="cover" />
                <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem, { marginTop: 6 }]}>
                  {timeLabel(msg.createdAt)}
                </Text>
              </TouchableOpacity>
            ) : msg.type === "video" && msg.mediaUrl ? (
              <TouchableOpacity style={styles.msgVideoBox} onPress={() => { setViewerMedia(msg.mediaUrl); setViewerType("video"); setViewerVisible(true); }}>
                <View style={styles.msgVideoPlay}><Ionicons name="play" size={22} color="#fff" /></View>
                <Text style={styles.msgVideoText}>Tap to play video</Text>
                <Text style={[styles.msgTime, { color: "rgba(255,255,255,0.6)", marginTop: 4 }]}>{timeLabel(msg.createdAt)}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.text}</Text>
                <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
                  {timeLabel(msg.createdAt)}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Reaction chips under the bubble */}
        {reactionEntries.length > 0 && (
          <View style={[styles.reactionRow, isMe && { justifyContent: "flex-end", marginRight: 6 }, !isMe && { marginLeft: 44 }]}>
            {reactionEntries.map(([emoji, uids]) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionChip, uids.includes(user.uid) && styles.reactionChipMine]}
                activeOpacity={0.7}
                onPress={() => toggleReaction(msg, emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {uids.length > 1 && <Text style={styles.reactionCount}>{uids.length}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const items = groupedMessages();

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Messages"); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("SellerProfile", { sellerId: otherUserId, sellerName: otherUserName })}
        >
          {renderAvatar(false)}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{otherUserName}</Text>
            {listingName ? (
              <Text style={styles.headerListing} numberOfLines={1}>🛍️ {listingName}</Text>
            ) : (
              <Text style={styles.headerOnline}>SLSU Student</Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <ScrollView
          ref={scrollRef}
          style={[styles.messagesList, { backgroundColor: LIGHT_BG }]}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 && (
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={GREEN} />
              </View>
              <Text style={styles.emptyChatTitle}>Start the conversation</Text>
              <Text style={styles.emptyChatSub}>Say hello to {otherUserName}!</Text>
            </View>
          )}

          {items.map((item) =>
            item.type === "date" ? (
              <View key={item.id} style={styles.dateDivider}>
                <View style={styles.dateDividerLine} />
                <Text style={styles.dateDividerText}>{item.label}</Text>
                <View style={styles.dateDividerLine} />
              </View>
            ) : renderMessage(item)
          )}

          {uploadingMedia && (
            <View style={[styles.msgRow, styles.msgRowMe]}>
              <View style={[styles.msgBubble, styles.msgBubbleMe, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={{ color: "#fff", fontSize: 13 }}>Uploading...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Reply bar shows what you're replying to */}
        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarName} numberOfLines={1}>
                Replying to {replyTo.senderId === user.uid ? "yourself" : (replyTo.senderName || otherUserName)}
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyTo.text || (replyTo.type === "image" ? "📷 Photo" : "🎥 Video")}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} activeOpacity={0.7} style={styles.replyBarClose}>
              <Ionicons name="close" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <TouchableOpacity style={styles.mediaBtn} activeOpacity={0.7} onPress={showMediaOptions}>
            <Ionicons name="add" size={24} color={GREEN} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor="#bbb"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleSendText}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        presentationStyle="fullScreen"
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />

          {/* Top bar with a back arrow — also works with the hardware back button */}
          <View style={styles.viewerTopBar}>
            <TouchableOpacity style={styles.viewerBackBtn} activeOpacity={0.7} onPress={closeViewer}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.viewerTitle}>
              {viewerType === "video" ? "Video" : "Photo"}
            </Text>
            <TouchableOpacity style={styles.viewerBackBtn} activeOpacity={0.7} onPress={closeViewer}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {viewerType === "image" && viewerMedia && (
            <Image source={{ uri: viewerMedia }} style={styles.viewerImage} resizeMode="contain" />
          )}
          {viewerType === "video" && viewerMedia && (
            <VideoView
              style={styles.viewerVideo}
              player={videoPlayer}
              allowsFullscreen
              allowsPictureInPicture={false}
              nativeControls
              contentFit="contain"
            />
          )}
        </View>
      </Modal>

      {/* Long-press action sheet: react / reply / delete */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setActionMsg(null)}>
          <View style={styles.sheet}>
            {/* Emoji reaction row */}
            <View style={styles.emojiRow}>
              {REACTIONS.map((emoji) => {
                const mine = actionMsg?.reactions?.[emoji]?.includes(user.uid);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.emojiBtn, mine && styles.emojiBtnActive]}
                    activeOpacity={0.7}
                    onPress={() => toggleReaction(actionMsg, emoji)}
                  >
                    <Text style={styles.emojiBtnText}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetDivider} />

            <TouchableOpacity
              style={styles.sheetItem}
              activeOpacity={0.7}
              onPress={() => { setReplyTo(actionMsg); setActionMsg(null); }}
            >
              <Ionicons name="arrow-undo-outline" size={20} color="#333" style={{ marginRight: 14 }} />
              <Text style={styles.sheetItemText}>Reply</Text>
            </TouchableOpacity>

            {actionMsg?.senderId === user.uid && (
              <TouchableOpacity
                style={styles.sheetItem}
                activeOpacity={0.7}
                onPress={() => deleteMessage(actionMsg)}
              >
                <Ionicons name="trash-outline" size={20} color="#e74c3c" style={{ marginRight: 14 }} />
                <Text style={[styles.sheetItemText, { color: "#e74c3c" }]}>Delete for everyone</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.sheetCancel} activeOpacity={0.7} onPress={() => setActionMsg(null)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: GREEN, elevation: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerInfo: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 10 },
  headerName: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerListing: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 1, maxWidth: 180 },
  headerOnline: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8, flexGrow: 1 },

  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyChatIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyChatTitle: { fontSize: 17, fontWeight: "800", color: "#333", marginBottom: 6 },
  emptyChatSub: { fontSize: 13, color: "#999" },

  dateDivider: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: "#E0E8DB" },
  dateDividerText: { fontSize: 11, color: "#aaa", fontWeight: "600", paddingHorizontal: 4 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6 },
  msgRowMe: { justifyContent: "flex-end" },
  msgBubble: { maxWidth: "75%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff", elevation: 1, borderBottomLeftRadius: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  msgBubbleMe: { backgroundColor: GREEN, borderBottomLeftRadius: 20, borderBottomRightRadius: 4, elevation: 2 },
  msgBubbleThem: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEF0EC" },
  msgText: { fontSize: 15, color: "#1a1a1a", lineHeight: 21 },
  msgTextMe: { color: "#fff" },
  msgTime: { fontSize: 10, marginTop: 3, alignSelf: "flex-end" },
  msgTimeMe: { color: "rgba(255,255,255,0.6)" },
  msgTimeThem: { color: "#bbb" },
  msgImage: { width: 210, height: 160, borderRadius: 14 },
  msgVideoBox: { width: 210, height: 130, borderRadius: 14, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  msgVideoPlay: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  msgVideoText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#EAEAEA" },
  mediaBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", marginRight: 8 },
  textInput: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: "#F5F5F5", borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, fontSize: 15, color: "#222", borderWidth: 1, borderColor: "#E8EDE5" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", marginLeft: 8, elevation: 3 },
  sendBtnDisabled: { backgroundColor: "#D0D0D0", elevation: 0 },
  viewerOverlay: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  viewerTopBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: STATUSBAR_TOP + 10, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: "rgba(0,0,0,0.4)" },
  viewerBackBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  viewerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  viewerCloseBtn: { position: "absolute", top: 52, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  viewerImage: { width: "100%", height: "100%" },
  viewerVideo: { width: "100%", height: "100%", backgroundColor: "#000" },
  viewerVideoBox: { alignItems: "center", paddingHorizontal: 40 },

  // Reply preview inside a bubble
  replyPreview: { borderLeftWidth: 3, borderLeftColor: GREEN, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  replyPreviewMe: { borderLeftColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.15)" },
  replyName: { fontSize: 11, fontWeight: "700", color: GREEN, marginBottom: 1 },
  replySnippet: { fontSize: 12, color: "#666" },

  // Reply bar above the input
  replyBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#EAEAEA", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  replyBarLine: { width: 3, height: 34, borderRadius: 2, backgroundColor: GREEN },
  replyBarName: { fontSize: 12, fontWeight: "700", color: GREEN },
  replyBarText: { fontSize: 12, color: "#888", marginTop: 1 },
  replyBarClose: { padding: 4 },

  // Reaction chips under bubbles
  reactionRow: { flexDirection: "row", gap: 4, marginTop: -2, flexWrap: "wrap" },
  reactionChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#E8EDE5", elevation: 1 },
  reactionChipMine: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: "#666", fontWeight: "600" },

  // Long-press action sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, paddingBottom: 26, paddingHorizontal: 16 },
  emojiRow: { flexDirection: "row", justifyContent: "space-around", paddingBottom: 14 },
  emojiBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7F3" },
  emojiBtnActive: { backgroundColor: GREEN_LIGHT, borderWidth: 2, borderColor: GREEN },
  emojiBtnText: { fontSize: 24 },
  sheetDivider: { height: 1, backgroundColor: "#EEE", marginBottom: 6 },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 6 },
  sheetItemText: { fontSize: 15, fontWeight: "600", color: "#222" },
  sheetCancel: { marginTop: 8, height: 48, borderRadius: 14, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  sheetCancelText: { fontSize: 15, fontWeight: "700", color: "#666" },
});
