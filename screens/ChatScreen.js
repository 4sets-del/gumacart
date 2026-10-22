import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform, StatusBar, TextInput, KeyboardAvoidingView, ActivityIndicator, Keyboard,
} from "react-native";
import { Alert } from '../components/AppAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment, deleteDoc, getDoc, limit,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";
import { Image as CachedImage } from "expo-image";
import { uploadFile } from "../utils/upload";
import { colorForName, FONTS } from "../constants/theme";
import { academicLabel } from "../constants/school";
import Sheet, { SheetOption } from "../components/Sheet";
import { useTheme } from '../context/ThemeContext';
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;


// Emoji users can react with
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function timeLabel(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Most photos/videos that can be picked from the gallery at once.
const MAX_MEDIA = 10;

// A photo or video with nothing else in its bubble (no reply preview).
function isBareMedia(msg) {
  return (msg.type === "image" || msg.type === "video") && msg.mediaUrl && !msg.replyTo;
}

export default function ChatScreen({ route, navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const { conversationId, otherUserId, otherUserName, listingName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [otherUserPhoto, setOtherUserPhoto] = useState(null);
  const [otherUserLabel, setOtherUserLabel] = useState("SLSU Student");
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
        if (otherUserDoc.exists()) {
          setOtherUserPhoto(otherUserDoc.data()?.photoURL || null);
          setOtherUserLabel(academicLabel(otherUserDoc.data()));
        }
      } catch (e) {}
    };
    if (otherUserId) fetchOtherUserPhoto();
  }, [otherUserId]);

  // Only the latest messages are loaded; "Load earlier messages" grows the
  // window, so long chats open quickly.
  const PAGE = 50;
  const [messageLimit, setMessageLimit] = useState(PAGE);
  const [hasEarlier, setHasEarlier] = useState(false);
  const loadingEarlierRef = useRef(false);
  // Whether the user is looking at the newest messages (not scrolled up).
  const atBottomRef = useRef(true);

  // Like Messenger: when the keyboard opens, keep the latest message in view
  // just above it, unless the user had scrolled up to read older messages.
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
      if (atBottomRef.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

  const trackBottom = ({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
    atBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  };

  const loadEarlier = () => {
    loadingEarlierRef.current = true; // keep the scroll position instead of jumping to the end
    setMessageLimit((n) => n + PAGE);
  };

  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "desc"),
      limit(messageLimit),
    );
    // If this user previously deleted the conversation, only show messages
    // sent after that moment (the other person still has the full history).
    let clearedAtMs = 0;
    let latestDocs = [];
    const show = () => setMessages(
      latestDocs
        .map((d) => ({ id: d.id, ...d.data() }))
        .reverse() // newest-first from the query; display oldest-first
        .filter((m) => !clearedAtMs || !m.createdAt?.toMillis || m.createdAt.toMillis() > clearedAtMs),
    );
    getDoc(doc(db, "conversations", conversationId))
      .then((c) => { clearedAtMs = c.data()?.clearedAt?.[user.uid]?.toMillis?.() || 0; show(); })
      .catch(() => {});
    const unsubscribe = onSnapshot(q, (snapshot) => {
      latestDocs = snapshot.docs;
      setHasEarlier(snapshot.size >= messageLimit);
      show();
      if (!loadingEarlierRef.current) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });
    return unsubscribe;
  }, [conversationId, messageLimit]);

  // "Seen": when the other person last read this chat (live).
  const [otherReadMs, setOtherReadMs] = useState(0);
  useEffect(() => {
    if (!conversationId || !otherUserId) return;
    return onSnapshot(
      doc(db, "conversations", conversationId),
      (snap) => setOtherReadMs(snap.data()?.lastReadAt?.[otherUserId]?.toMillis?.() || 0),
      () => {},
    );
  }, [conversationId, otherUserId]);

  // Record that I've read up to the newest message from the other person.
  // Only written when a new incoming message appears, not on every render.
  const lastMarkedRef = useRef(null);
  const newestIncoming = [...messages].reverse().find((m) => m.senderId !== user.uid);
  useEffect(() => {
    if (!conversationId || !newestIncoming || lastMarkedRef.current === newestIncoming.id) return;
    lastMarkedRef.current = newestIncoming.id;
    updateDoc(doc(db, "conversations", conversationId), {
      [`lastReadAt.${user.uid}`]: serverTimestamp(),
      [`unreadCount.${user.uid}`]: 0,
    }).catch(() => {});
  }, [conversationId, newestIncoming?.id, user.uid]);

  // Under my latest message: "Seen" once the other person has read it.
  const myLatest = [...messages].reverse().find((m) => m.senderId === user.uid);
  const myLatestSeen = !!myLatest?.createdAt?.toMillis && otherReadMs >= myLatest.createdAt.toMillis();

  // Safety net: whenever the viewer is hidden, make sure playback stops.
  useEffect(() => {
    if (!viewerVisible && videoPlayer) {
      try { videoPlayer.pause(); } catch (e) {}
    }
  }, [viewerVisible]);

  const sendMessage = async (msgData, { withReply = true } = {}) => {
    if (!msgData.text?.trim() && !msgData.mediaUrl) return;
    setSending(true);
    try {
      const convoRef = doc(db, "conversations", conversationId);

      // Attach reply context if the user is replying
      const replyPayload = replyTo && withReply ? {
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
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"], quality: 0.7,
          allowsMultipleSelection: true, selectionLimit: MAX_MEDIA, orderedSelection: true,
        });
    if (result.canceled || !result.assets?.length) return;

    const assets = result.assets.slice(0, MAX_MEDIA);
    let failed = 0;
    setUploadingMedia({ done: 0, total: assets.length });
    // Sent one by one so they arrive in the order they were picked.
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const isVideo = asset.type === "video";
      try {
        const filename = `chats/${conversationId}/${Date.now()}_${i}.${isVideo ? "mp4" : "jpg"}`;
        // Photos are compressed before upload; videos are sent as recorded.
        const mediaUrl = await uploadFile(asset.uri, filename, { compress: !isVideo });
        await sendMessage({ text: "", type: isVideo ? "video" : "image", mediaUrl }, { withReply: i === 0 });
      } catch (e) {
        failed++;
      }
      setUploadingMedia({ done: i + 1, total: assets.length });
    }
    setUploadingMedia(false);
    if (failed) Alert.alert("Upload failed", failed === assets.length ? "Failed to upload media." : `${failed} of ${assets.length} couldn't be sent.`);
  };

  const showMediaOptions = () => {
    Alert.alert("Send Media", "Choose an option", [
      { text: "Take Photo/Video", icon: "camera", onPress: () => pickMedia("camera") },
      { text: `Choose from Gallery (up to ${MAX_MEDIA})`, icon: "images", onPress: () => pickMedia("gallery") },
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
      return <CachedImage source={{ uri: otherUserPhoto }} style={{ width: size, height: size, borderRadius: size / 2, marginRight: small ? 8 : 10 }} cachePolicy="memory-disk" />;
    }
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorForName(otherUserName), alignItems: "center", justifyContent: "center", marginRight: small ? 8 : 10 }}>
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
          <View style={[
            styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem,
            // Photos and videos show on their own, without a colored frame.
            isBareMedia(msg) && styles.msgBubbleBare,
            msg.type === "listing" && styles.msgBubbleCard,
          ]}>

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

            {msg.type === "listing" ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("ProductDetail", { id: msg.listingId })}>
                {msg.listingImage ? (
                  <CachedImage source={{ uri: msg.listingImage }} style={styles.cardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImageEmpty]}><Ionicons name="image-outline" size={32} color={COLORS.textMuted} /></View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>{msg.listingName}</Text>
                  {msg.listingPrice ? <Text style={styles.cardPrice}>{msg.listingPrice}</Text> : null}
                  <View style={styles.cardLink}>
                    <Text style={styles.cardLinkText}>View listing</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                  </View>
                </View>
                <View style={[styles.cardMessage, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                  <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.text}</Text>
                  <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>{timeLabel(msg.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ) : msg.type === "image" && msg.mediaUrl ? (
              <TouchableOpacity onPress={() => { setViewerMedia(msg.mediaUrl); setViewerType("image"); setViewerVisible(true); }}>
                <CachedImage source={{ uri: msg.mediaUrl }} style={styles.msgImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                <View style={styles.mediaTime}>
                  <Text style={styles.mediaTimeText}>{timeLabel(msg.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ) : msg.type === "video" && msg.mediaUrl ? (
              <TouchableOpacity style={styles.msgVideoBox} onPress={() => { setViewerMedia(msg.mediaUrl); setViewerType("video"); setViewerVisible(true); }}>
                <View style={styles.msgVideoPlay}><Ionicons name="play" size={22} color="#fff" /></View>
                <Text style={styles.msgVideoText}>Tap to play video</Text>
                <View style={styles.mediaTime}>
                  <Text style={styles.mediaTimeText}>{timeLabel(msg.createdAt)}</Text>
                </View>
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

        {msg.id === myLatest?.id && (
          <View style={styles.seenRow}>
            <Ionicons name={myLatestSeen ? "checkmark-done" : "checkmark"} size={14} color={myLatestSeen ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.seenText, myLatestSeen && { color: COLORS.primary }]}>{myLatestSeen ? "Seen" : "Sent"}</Text>
          </View>
        )}

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
      <StatusBar barStyle={COLORS.statusBar} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Messages" }); }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("SellerProfile", { sellerId: otherUserId, sellerName: otherUserName })}
        >
          {renderAvatar(false)}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{otherUserName}</Text>
            {listingName ? (
              <Text style={styles.headerListing} numberOfLines={1}>{listingName}</Text>
            ) : (
              <Text style={styles.headerOnline} numberOfLines={1}>{otherUserLabel}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View profile"
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("SellerProfile", { sellerId: otherUserId, sellerName: otherUserName })}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          // The list gets shorter when the keyboard opens; stay pinned to the end.
          onLayout={() => { if (atBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false }); }}
          // Only the user's own scrolling decides this, so the list shrinking
          // under the keyboard doesn't count as "scrolled up".
          onScrollEndDrag={trackBottom}
          onMomentumScrollEnd={trackBottom}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // After loading earlier messages, stay where the user is reading.
            if (loadingEarlierRef.current) { loadingEarlierRef.current = false; return; }
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
          showsVerticalScrollIndicator={false}
        >
          {hasEarlier && (
            <TouchableOpacity style={styles.loadEarlierBtn} activeOpacity={0.7} onPress={loadEarlier}>
              <Ionicons name="time-outline" size={14} color={COLORS.primary} />
              <Text style={styles.loadEarlierText}>Load earlier messages</Text>
            </TouchableOpacity>
          )}

          {items.length === 0 && (
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={COLORS.primary} />
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
                <Text style={{ color: "#fff", fontSize: 13 }}>
                  {uploadingMedia.total > 1 ? `Sending ${Math.min(uploadingMedia.done + 1, uploadingMedia.total)} of ${uploadingMedia.total}...` : "Uploading..."}
                </Text>
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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} activeOpacity={0.7} style={styles.replyBarClose}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Attach photo or video" style={styles.mediaBtn} activeOpacity={0.7} onPress={showMediaOptions}>
            <Ionicons name="attach" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message"
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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close viewer" style={styles.viewerBackBtn} activeOpacity={0.7} onPress={closeViewer}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.viewerTitle}>
              {viewerType === "video" ? "Video" : "Photo"}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" style={styles.viewerBackBtn} activeOpacity={0.7} onPress={closeViewer}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {viewerType === "image" && viewerMedia && (
            <CachedImage source={{ uri: viewerMedia }} style={styles.viewerImage} contentFit="contain" cachePolicy="memory-disk" />
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
      <Sheet
        visible={!!actionMsg}
        onClose={() => setActionMsg(null)}
        title="Message"
        subtitle={actionMsg ? (actionMsg.type === "image" ? "📷 Photo" : actionMsg.type === "video" ? "🎥 Video" : actionMsg.type === "listing" ? `🛍️ ${actionMsg.listingName}` : actionMsg.text) : ""}
        icon="chatbubble-ellipses"
        footer={null}
      >
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
        <SheetOption icon="arrow-undo" label="Reply" onPress={() => { setReplyTo(actionMsg); setActionMsg(null); }} />
        {actionMsg?.senderId === user.uid && (
          <SheetOption icon="trash" tone="danger" label="Delete for everyone" onPress={() => deleteMessage(actionMsg)} />
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface, paddingTop: STATUSBAR_TOP },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerInfo: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 2 },
  headerName: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  headerListing: { fontSize: 12, color: COLORS.primary, marginTop: 1, maxWidth: 200 },
  headerOnline: { fontSize: 12, color: COLORS.primary, marginTop: 1 },
  messagesList: { flex: 1, backgroundColor: COLORS.surface },
  messagesContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8, flexGrow: 1 },

  seenRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2, marginRight: 4 },
  seenText: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  loadEarlierBtn: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 6, backgroundColor: COLORS.primaryPale, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 10 },
  loadEarlierText: { fontSize: 12.5, fontWeight: "700", color: COLORS.primary },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyChatIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryPale, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyChatTitle: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 6 },
  emptyChatSub: { fontSize: 13, color: COLORS.textMuted },

  dateDivider: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dateDividerText: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", paddingHorizontal: 4 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6 },
  msgRowMe: { justifyContent: "flex-end" },
  msgBubble: { maxWidth: "75%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: COLORS.bubbleSent, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  msgBubbleThem: { backgroundColor: COLORS.bubbleReceived },
  msgText: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 21 },
  msgTextMe: { color: "#fff" },
  msgTime: { fontSize: 10, marginTop: 3, alignSelf: "flex-end" },
  msgTimeMe: { color: "rgba(255,255,255,0.7)" },
  msgTimeThem: { color: COLORS.textMuted },
  msgBubbleBare: { backgroundColor: "transparent", paddingHorizontal: 0, paddingVertical: 0 },
  msgBubbleCard: {
    width: 240, paddingHorizontal: 0, paddingVertical: 0, overflow: "hidden",
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  msgImage: { width: 230, height: 230, borderRadius: 18, backgroundColor: COLORS.surfaceAlt },
  msgVideoBox: { width: 230, height: 150, borderRadius: 18, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  mediaTime: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  mediaTimeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  cardImage: { width: "100%", height: 150, backgroundColor: COLORS.surfaceAlt },
  cardImageEmpty: { alignItems: "center", justifyContent: "center" },
  cardBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  cardName: { fontFamily: FONTS.heading, fontSize: 15, color: COLORS.textPrimary },
  cardPrice: { fontSize: 15, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  cardLink: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 6 },
  cardLinkText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  cardMessage: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 0 },
  msgVideoPlay: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  msgVideoText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 10, paddingTop: 10, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  mediaBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginRight: 4 },
  textInput: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: COLORS.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  sendBtnDisabled: { backgroundColor: COLORS.borderStrong },
  viewerOverlay: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  viewerTopBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: STATUSBAR_TOP + 10, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: "rgba(0,0,0,0.4)" },
  viewerBackBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  viewerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  viewerImage: { width: "100%", height: "100%" },
  viewerVideo: { width: "100%", height: "100%", backgroundColor: "#000" },

  // Reply preview inside a bubble
  replyPreview: { borderLeftWidth: 3, borderLeftColor: COLORS.primary, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  replyPreviewMe: { borderLeftColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.15)" },
  replyName: { fontSize: 11, fontWeight: "700", color: COLORS.primary, marginBottom: 1 },
  replySnippet: { fontSize: 12, color: COLORS.textSecondary },

  // Reply bar above the input
  replyBar: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  replyBarLine: { width: 3, height: 34, borderRadius: 2, backgroundColor: COLORS.primary },
  replyBarName: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  replyBarText: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  replyBarClose: { padding: 4 },

  // Reaction chips under bubbles
  reactionRow: { flexDirection: "row", gap: 4, marginTop: -2, flexWrap: "wrap" },
  reactionChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border, elevation: 1 },
  reactionChipMine: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600" },

  // Long-press action sheet
  emojiRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 14 },
  emojiBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceAlt },
  emojiBtnActive: { backgroundColor: COLORS.primaryPale, borderWidth: 2, borderColor: COLORS.primary },
  emojiBtnText: { fontSize: 24 },
});
