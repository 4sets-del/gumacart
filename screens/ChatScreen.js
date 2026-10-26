import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { pickFromGallery } from "../utils/pickFromGallery";
import { auth, db, storage } from "../firebaseConfig";
import { Image as CachedImage } from "expo-image";
import { uploadFile } from "../utils/upload";
import { colorForName, FONTS } from "../constants/theme";
import { academicLabel } from "../constants/school";
import Sheet, { SheetOption } from "../components/Sheet";
import { VoiceRecorder, VoiceBubble } from "../components/VoiceMessage";
import ZoomableImage from "../components/ZoomableImage";
import * as Haptics from "expo-haptics";
import { markSoldTo } from "../utils/sales";
import { usePresence } from "../utils/presence";
import { dismissChatNotification } from "../utils/notifications";
import { useBlocked, blockUser, unblockUser, hasBlockedMe } from "../utils/blocking";
import ReportSheet from "../components/ReportSheet";
import { reportMessage, messageSummary, MESSAGE_REPORT_REASONS } from "../utils/reportMessage";
import { useActiveListings } from "../utils/useListings";
import { getUserBasics } from "../utils/userCache";
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
  const { conversationId, otherUserId, listingName } = route.params;
  // Older listings may not carry the seller's name.
  const otherUserName = route.params.otherUserName || "User";
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

  // From the shared profile cache, so reopening a chat doesn't re-download it.
  useEffect(() => {
    if (!otherUserId) return;
    let alive = true;
    getUserBasics(otherUserId).then((basics) => {
      if (!alive) return;
      setOtherUserPhoto(basics.photoURL);
      setOtherUserLabel(academicLabel(basics));
    });
    return () => { alive = false; };
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

  // "typing…": each side stamps typing.{uid} on the conversation while typing
  // (at most every 3s); it counts as typing for 6s after the last stamp.
  const [otherTypingMs, setOtherTypingMs] = useState(0);
  const [, setTypingTick] = useState(0);
  const otherTyping = otherTypingMs > 0 && Date.now() - otherTypingMs < 6000;
  useEffect(() => {
    if (!otherTyping) return;
    const id = setTimeout(() => setTypingTick((t) => t + 1), 6000 - (Date.now() - otherTypingMs) + 50);
    return () => clearTimeout(id);
  }, [otherTyping, otherTypingMs]);
  const lastTypingSent = useRef(0);
  const onType = (value) => {
    setText(value);
    if (!value.trim() || !conversationId) return;
    if (Date.now() - lastTypingSent.current < 3000) return;
    lastTypingSent.current = Date.now();
    updateDoc(doc(db, "conversations", conversationId), { [`typing.${user.uid}`]: serverTimestamp() }).catch(() => {});
  };
  const presence = usePresence(otherUserId);
  useEffect(() => {
    if (!conversationId || !otherUserId) return;
    return onSnapshot(
      doc(db, "conversations", conversationId),
      (snap) => {
        setOtherReadMs(snap.data()?.lastReadAt?.[otherUserId]?.toMillis?.() || 0);
        setOtherTypingMs(snap.data()?.typing?.[otherUserId]?.toMillis?.() || 0);
      },
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

  // clearComposer: only for what was typed in the message box, so sending a
  // photo, voice message or listing doesn't erase a draft.
  const sendMessage = async (msgData, { withReply = true, clearComposer = false } = {}) => {
    if (!msgData.text?.trim() && !msgData.mediaUrl) return;
    if (iBlocked || blockedByThem) return; // the input is hidden then; this guards photos, quick replies, etc.
    setSending(true);
    try {
      const convoRef = doc(db, "conversations", conversationId);

      // Attach reply context if the user is replying
      const replyPayload = replyTo && withReply ? {
        replyTo: {
          id: replyTo.id,
          text: replyTo.text || (replyTo.type === "image" ? "📷 Photo" : replyTo.type === "video" ? "🎥 Video" : replyTo.type === "audio" ? "🎤 Voice message" : ""),
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
        lastMessage: msgData.text || (msgData.type === "image" ? "📷 Photo" : msgData.type === "audio" ? "🎤 Voice message" : "🎥 Video"),
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${otherUserId}`]: increment(1),
      });
      if (clearComposer) setText("");
      if (withReply && replyTo) setReplyTo(null);
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

  // ── Editing my own text messages (like Messenger: within 15 minutes) ──
  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const [editingMsg, setEditingMsg] = useState(null);
  const canEdit = (m) => m?.senderId === user.uid && (m.type || "text") === "text"
    && Date.now() - (m.createdAt?.toMillis?.() || 0) < EDIT_WINDOW_MS;
  const startEdit = (m) => {
    setActionMsg(null);
    setReplyTo(null);
    setEditingMsg(m);
    setText(m.text || "");
  };
  const cancelEdit = () => { setEditingMsg(null); setText(""); };
  const saveEdit = async () => {
    const newText = text.trim();
    const m = editingMsg;
    if (!newText || !m) return;
    if (newText === m.text) { cancelEdit(); return; }
    if (!canEdit(m)) {
      Alert.alert("Can't edit anymore", "Messages can only be edited within 15 minutes of sending.");
      cancelEdit();
      return;
    }
    setSending(true);
    try {
      await updateDoc(doc(db, "conversations", conversationId, "messages", m.id), { text: newText, editedAt: serverTimestamp() });
      // Keep the inbox preview right if it was the latest message.
      if (messages[messages.length - 1]?.id === m.id) {
        await updateDoc(doc(db, "conversations", conversationId), { lastMessage: newText });
      }
      cancelEdit();
    } catch (e) {
      Alert.alert("Error", "Could not edit the message.");
    } finally {
      setSending(false);
    }
  };

  const handleSendText = () => {
    if (editingMsg) { saveEdit(); return; }
    if (!text.trim()) return;
    sendMessage({ text: text.trim(), type: "text" }, { clearComposer: true });
    lastTypingSent.current = 0;
    updateDoc(doc(db, "conversations", conversationId), { [`typing.${user.uid}`]: null }).catch(() => {});
  };

  const pickMedia = async (type) => {
    const permission = type === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed"); return; }

    const result = type === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.7 })
      : await pickFromGallery({
          mediaTypes: ["images", "videos"], quality: 0.7,
          allowsMultipleSelection: true, selectionLimit: MAX_MEDIA, orderedSelection: true,
        });
    if (result.canceled || !result.assets?.length) return;

    const assets = result.assets.slice(0, MAX_MEDIA);
    if (result.assets.length > MAX_MEDIA) {
      Alert.alert("Too many picked", `You can send up to ${MAX_MEDIA} at once, so only the first ${MAX_MEDIA} will be sent.`);
    }
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

  // Opening the chat clears its notification from the phone's tray.
  useEffect(() => { dismissChatNotification(conversationId); }, [conversationId]);


  // ── Blocking ──
  const [menuOpen, setMenuOpen] = useState(false);
  const iBlocked = useBlocked().ids.has(otherUserId);
  const [blockedByThem, setBlockedByThem] = useState(false);
  useEffect(() => {
    if (otherUserId) hasBlockedMe(otherUserId).then(setBlockedByThem);
  }, [otherUserId]);
  const confirmBlock = () => {
    setMenuOpen(false);
    Alert.alert(`Block ${otherUserName}?`, "They won't be able to message you, and their listings will be hidden from you. They won't be told. You can unblock them anytime in Settings.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => blockUser({ id: otherUserId, name: otherUserName, photoURL: otherUserPhoto })
        .catch(() => Alert.alert("Error", "Could not block this person.")) },
    ]);
  };

  // ── Reporting a message ──
  const [reportMsg, setReportMsg] = useState(null);
  const [reportReason, setReportReason] = useState(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const openMessageReport = (msg) => { setActionMsg(null); setReportReason(null); setReportDetails(""); setReportMsg(msg); };
  const closeMessageReport = () => { if (!reportSending) setReportMsg(null); };
  const submitMessageReport = async () => {
    const reason = reportReason === "Other" ? reportDetails.trim() : reportReason;
    if (!reason || (reportReason === "Other" && reason.length < 3)) {
      Alert.alert("Please specify", "Type a short reason so admins know the issue.");
      return;
    }
    setReportSending(true);
    try {
      await reportMessage({ message: reportMsg, messages, conversationId, otherUserName, reason });
      setReportMsg(null);
      Alert.alert("Report sent", "Thank you. An admin will review it. You'll be notified when it's been looked at.");
    } catch (e) {
      Alert.alert("Error", "Could not send the report. Please try again.");
    } finally {
      setReportSending(false);
    }
  };

  // ── Voice messages ──
  const [recording, setRecording] = useState(false);
  const sendVoice = async (uri, durationMs) => {
    setRecording(false);
    setUploadingMedia({ done: 0, total: 1 });
    try {
      const mediaUrl = await uploadFile(uri, `chats/${conversationId}/${Date.now()}.m4a`, { compress: false, contentType: "audio/mp4" });
      await sendMessage({ text: "", type: "audio", mediaUrl, durationMs: Math.round(durationMs) });
    } catch (e) {
      Alert.alert("Error", "Could not send the voice message.");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Live listings (to find my items when marking one sold from the chat).
  const { listings: activeListings } = useActiveListings({ includeOwn: true });

  // Who's selling in this chat, from the items talked about in it
  // (product cards / replies that mention a listing).
  const chatListings = useMemo(() => {
    const ids = new Set(messages.filter((m) => m.listingId).map((m) => m.listingId));
    return activeListings.filter((l) => ids.has(l.id));
  }, [messages, activeListings]);
  const iAmSeller = chatListings.some((l) => l.sellerId === user.uid);

  // ── Mark as sold from the chat (for my items) ──
  const myListings = useMemo(() => {
    const talked = new Set(chatListings.map((l) => l.id));
    return activeListings
      .filter((l) => l.sellerId === user.uid && l.status === "active")
      .sort((a, b) => talked.has(b.id) - talked.has(a.id));
  }, [activeListings, chatListings, user.uid]);
  const talkedAboutMine = myListings.filter((l) => chatListings.some((c) => c.id === l.id));
  const [soldPicker, setSoldPicker] = useState(false);
  const confirmSold = (listing) => {
    setSoldPicker(false);
    const stock = Math.max(1, Number(listing.quantity) || 1);
    Alert.alert(
      stock > 1 ? "Sold one to them?" : "Mark as sold?",
      stock > 1
        ? `One "${listing.name}" sold to ${otherUserName} (${stock - 1} left after this). They'll be asked to rate you.`
        : `"${listing.name}" will be marked sold to ${otherUserName}. They'll be asked to rate you, and others who were interested are told.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: stock > 1 ? "Sold one" : "Mark sold", icon: "bag-check", onPress: async () => {
          try {
            await markSoldTo(listing, otherUserId);
            await sendMessage({ type: "text", text: `✅ Marked "${listing.name}" as sold to you. Salamat po!` }, { withReply: false });
          } catch (e) {
            Alert.alert("Error", "Could not mark it as sold.");
          }
        } },
      ],
    );
  };
  const openSold = () => {
    setMenuOpen(false);
    if (talkedAboutMine.length === 1) confirmSold(talkedAboutMine[0]);
    else setSoldPicker(true);
  };

  // ── Quick replies: tap to send a common message instead of typing ──
  const quickReplies = iAmSeller
    ? ["Available pa po ✅", "Saan po tayo magkikita?", "Kailan po kayo free?", "Sold na po, sorry 🙏", "Salamat po! 😊"]
    : ["Available pa po?", "Magkano po last price?", "Saan po tayo magkikita?", "Kailan po kayo free?", "Sige po, kukunin ko", "Salamat po! 😊"];
  const sendQuick = (t) => {
    Haptics.selectionAsync().catch(() => {});
    sendMessage({ text: t, type: "text" });
  };

  const showMediaOptions = () => {
    Alert.alert("Send", "Choose what to send", [
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
            ) : msg.type === "audio" && msg.mediaUrl ? (
              <>
                <VoiceBubble uri={msg.mediaUrl} durationMs={msg.durationMs} isMe={isMe} />
                <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>{timeLabel(msg.createdAt)}</Text>
              </>
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
                  {msg.editedAt ? "edited · " : ""}{timeLabel(msg.createdAt)}
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
            {otherTyping ? (
              <Text style={[styles.headerOnline, styles.headerTyping]} numberOfLines={1}>typing…</Text>
            ) : presence.active ? (
              <View style={styles.activeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.headerOnline} numberOfLines={1}>Active now</Text>
              </View>
            ) : listingName ? (
              <Text style={styles.headerListing} numberOfLines={1}>{listingName}</Text>
            ) : (
              <Text style={styles.headerOnline} numberOfLines={1}>{presence.label ? `${presence.label} · ${otherUserLabel}` : otherUserLabel}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Chat options"
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => setMenuOpen(true)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* The item this chat is about (if it's mine): mark it sold here. */}
      {talkedAboutMine.length > 0 && !iBlocked && !blockedByThem ? (
        <View style={styles.soldBar}>
          <Ionicons name="bag-handle" size={16} color={COLORS.primary} />
          <Text style={styles.soldBarText} numberOfLines={1}>
            {talkedAboutMine.length === 1 ? talkedAboutMine[0].name : `${talkedAboutMine.length} of your items`}
          </Text>
          <TouchableOpacity style={styles.soldBarBtn} onPress={openSold} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Mark as sold">
            <Text style={styles.soldBarBtnText}>Mark as sold</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Sheet visible={soldPicker} onClose={() => setSoldPicker(false)} title="Which item did they get?" subtitle={`Marked sold to ${otherUserName}`} icon="bag-check" footer={null}>
        {myListings.map((l) => (
          <SheetOption
            key={l.id}
            icon="pricetag"
            label={l.name}
            sub={`${chatListings.some((c) => c.id === l.id) ? "Talked about in this chat · " : ""}${(Number(l.quantity) || 1) > 1 ? `${l.quantity} in stock` : "1 item"}`}
            onPress={() => confirmSold(l)}
          />
        ))}
      </Sheet>

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
        {editingMsg ? (
          <View style={styles.replyBar}>
            <View style={[styles.replyBarLine, { backgroundColor: COLORS.warning }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyBarName, { color: COLORS.warning }]} numberOfLines={1}>Editing message</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>{editingMsg.text}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel editing" onPress={cancelEdit} activeOpacity={0.7} style={styles.replyBarClose}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarName} numberOfLines={1}>
                Replying to {replyTo.senderId === user.uid ? "yourself" : (replyTo.senderName || otherUserName)}
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyTo.text || (replyTo.type === "image" ? "📷 Photo" : replyTo.type === "audio" ? "🎤 Voice message" : "🎥 Video")}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} activeOpacity={0.7} style={styles.replyBarClose}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {!recording && !iBlocked && !blockedByThem && !text.trim() && !editingMsg ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={styles.quickBar} contentContainerStyle={styles.quickRow}>
            {quickReplies.map((t) => (
              <TouchableOpacity key={t} style={styles.quickChip} activeOpacity={0.8} onPress={() => sendQuick(t)} disabled={sending} accessibilityRole="button" accessibilityLabel={`Send: ${t}`}>
                <Text style={styles.quickText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        {recording && !iBlocked && !blockedByThem ? (
          <VoiceRecorder onSend={sendVoice} onCancel={() => setRecording(false)} bottomInset={insets.bottom} />
        ) : iBlocked || blockedByThem ? (
          <View style={[styles.blockedBar, { paddingBottom: 14 + insets.bottom }]}>
            <Ionicons name="ban" size={18} color={COLORS.textMuted} />
            <Text style={styles.blockedText}>
              {iBlocked ? `You blocked ${otherUserName}. You won't get messages from them.` : `You can't reply to this conversation.`}
            </Text>
            {iBlocked ? (
              <TouchableOpacity onPress={() => unblockUser(otherUserId).catch(() => {})} style={styles.unblockBtn}>
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={[styles.inputBar, !text.trim() && styles.inputBarJoined, { paddingBottom: 10 + insets.bottom }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send photos or videos" style={styles.mediaBtn} activeOpacity={0.7} onPress={showMediaOptions}>
              <Ionicons name="attach" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textMuted}
              value={text}
              onChangeText={onType}
              multiline
              maxLength={1000}
            />
            {text.trim() || sending || editingMsg ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={editingMsg ? "Save edit" : "Send message"}
                style={[styles.sendBtn, (sending || (editingMsg && !text.trim())) && styles.sendBtnDisabled]}
                activeOpacity={0.8}
                onPress={handleSendText}
                disabled={sending || (editingMsg && !text.trim())}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name={editingMsg ? "checkmark" : "send"} size={editingMsg ? 22 : 18} color="#fff" />
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Record a voice message"
                style={styles.sendBtn}
                activeOpacity={0.8}
                onPress={() => { Keyboard.dismiss(); setRecording(true); }}
              >
                <Ionicons name="mic" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
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
            <ZoomableImage uri={viewerMedia} style={styles.viewerImage} />
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
        subtitle={actionMsg ? messageSummary(actionMsg) : ""}
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
        <SheetOption icon="arrow-undo" label="Reply" onPress={() => { if (editingMsg) cancelEdit(); setReplyTo(actionMsg); setActionMsg(null); }} />
        {canEdit(actionMsg) ? (
          <SheetOption icon="create" label="Edit" sub="You can edit within 15 minutes of sending" onPress={() => startEdit(actionMsg)} />
        ) : null}
        {actionMsg?.senderId === user.uid ? (
          <SheetOption icon="trash" tone="danger" label="Delete for everyone" onPress={() => deleteMessage(actionMsg)} />
        ) : actionMsg ? (
          <SheetOption icon="flag" tone="danger" label="Report message" sub="Admins will review this message and the chat around it" onPress={() => openMessageReport(actionMsg)} />
        ) : null}
      </Sheet>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={otherUserName} subtitle={otherUserLabel} icon="person" footer={null}>
        <SheetOption icon="person-circle" label="View profile" sub="Ratings, reviews and their listings" onPress={() => { setMenuOpen(false); navigation.navigate("SellerProfile", { sellerId: otherUserId, sellerName: otherUserName }); }} />
        {iBlocked ? (
          <SheetOption icon="lock-open" label="Unblock" sub="Allow messages from them again" onPress={() => { setMenuOpen(false); unblockUser(otherUserId).catch(() => {}); }} />
        ) : (
          <SheetOption icon="ban" tone="danger" label="Block" sub="They can't message you, and you won't see their listings" onPress={confirmBlock} />
        )}
        {myListings.length > 0 && !iBlocked && !blockedByThem ? (
          <SheetOption icon="bag-check" label={`Mark an item as sold to ${otherUserName.split(" ")[0]}`} sub="They'll be asked to rate you" onPress={openSold} />
        ) : null}
        <SheetOption icon="flag" tone="danger" label="Report a message" sub="Long-press the message you want to report" onPress={() => { setMenuOpen(false); Alert.alert("Report a message", "Press and hold the message you want to report, then choose Report message."); }} />
      </Sheet>

      <ReportSheet
        visible={!!reportMsg}
        onClose={closeMessageReport}
        title="Report Message"
        question={`What's wrong with this message from ${otherUserName}?`}
        reasons={MESSAGE_REPORT_REASONS}
        reason={reportReason}
        onReason={(r) => { setReportReason(r); if (!r) setReportDetails(""); }}
        details={reportDetails}
        onDetails={setReportDetails}
        allowProof={false}
        preview={reportMsg ? (
          <View style={styles.reportPreview}>
            <Text style={styles.reportPreviewLabel}>Reported message</Text>
            <Text style={styles.reportPreviewText} numberOfLines={4}>{messageSummary(reportMsg)}</Text>
            <Text style={styles.reportPreviewHint}>The messages around it are included so admins see the full context. {otherUserName} won't be told who reported them.</Text>
          </View>
        ) : null}
        onSubmit={submitMessageReport}
        submitting={reportSending}
      />
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
  headerTyping: { fontStyle: "italic" },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
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
  soldBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.primaryPale, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  soldBarText: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  soldBarBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  soldBarBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  quickBar: { flexGrow: 0, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  quickRow: { gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  quickChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", backgroundColor: COLORS.primaryPale, borderWidth: 1, borderColor: COLORS.primary + "40" },
  inputBarJoined: { borderTopWidth: 0, paddingTop: 2 },
  quickText: { fontSize: 13.5, fontWeight: "600", color: COLORS.primary },
  blockedBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 14, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  blockedText: { flex: 1, fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 19 },
  unblockBtn: { backgroundColor: COLORS.primaryPale, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  unblockText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  reportPreview: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  reportPreviewLabel: { fontSize: 11.5, fontWeight: "800", color: COLORS.error, textTransform: "uppercase", letterSpacing: 0.5 },
  reportPreviewText: { fontSize: 14.5, color: COLORS.textPrimary, marginTop: 4, lineHeight: 20 },
  reportPreviewHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, lineHeight: 17 },
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
