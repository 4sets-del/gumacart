import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform, StatusBar, TextInput, KeyboardAvoidingView, ActivityIndicator, Keyboard,
} from "react-native";
import { Alert } from '../components/AppAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment, deleteDoc, getDoc, limit, Timestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../firebaseConfig";
import { Image as CachedImage } from "expo-image";
import { uploadFile } from "../utils/upload";
import { colorForName, FONTS } from "../constants/theme";
import { academicLabel } from "../constants/school";
import Sheet, { SheetOption } from "../components/Sheet";
import ZoomableImage from "../components/ZoomableImage";
import CoachMark from "../components/CoachMark";
import { useScreenTour } from "../utils/useScreenTour";
import OfferSheet from "../components/OfferSheet";
import MeetupSheet from "../components/MeetupSheet";
import { useActiveListings } from "../utils/useListings";
import { useTheme } from '../context/ThemeContext';
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;


const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

// "Mon, Oct 26 · 2:30 PM"
function meetupWhen(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

// A meet-up still waiting for an answer whose time is already over.
function meetupPassed(msg) {
  const ms = msg.at?.toMillis ? msg.at.toMillis() : new Date(msg.at).getTime();
  return msg.type === "meetup" && (msg.status || "pending") === "pending" && ms < Date.now();
}

const OFFER_STATUS = {
  pending: { label: "Waiting for reply", icon: "time-outline", tone: "warning" },
  accepted: { label: "Accepted", icon: "checkmark-circle", tone: "primary" },
  declined: { label: "Declined", icon: "close-circle", tone: "error" },
  withdrawn: { label: "Withdrawn", icon: "remove-circle", tone: "muted" },
};
const MEETUP_STATUS = {
  pending: { label: "Waiting for confirmation", icon: "time-outline", tone: "warning" },
  confirmed: { label: "Confirmed", icon: "checkmark-circle", tone: "primary" },
  declined: { label: "Declined", icon: "close-circle", tone: "error" },
  cancelled: { label: "Cancelled", icon: "remove-circle", tone: "muted" },
  passed: { label: "Time passed, not confirmed", icon: "time", tone: "muted" },
};

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

  // clearComposer: only for what was typed in the message box, so sending a
  // photo, offer or meet-up (or answering one) doesn't erase a draft.
  const sendMessage = async (msgData, { withReply = true, clearComposer = false } = {}) => {
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

  const handleSendText = () => {
    if (!text.trim()) return;
    sendMessage({ text: text.trim(), type: "text" }, { clearComposer: true });
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

  // First-time mini tour of the chat.
  const tourOriginRef = useRef(null);
  const headerInfoRef = useRef(null);
  const attachRef = useRef(null);
  const [tourVisible, finishTour] = useScreenTour('chat');
  const tourSteps = useMemo(() => [
    { ref: attachRef, icon: 'add-circle', shape: 'circle', title: 'More than messages', text: 'Tap here to send photos (up to 10), Make an Offer on an item, or Plan a Meet-up with a time and campus spot.' },
    { icon: 'happy', title: 'React & reply', text: 'Long-press any message to react with an emoji, reply to it, or delete your own message.' },
    { ref: headerInfoRef, icon: 'person', title: 'Who you\'re talking to', text: 'Tap their name to see their profile, ratings and other items.' },
    { icon: 'shield-checkmark', title: 'Stay safe', text: 'Agree on a public spot on campus, and check the item before you pay.' },
  ], []);

  // ── Offers & meet-ups ──
  const [offerOpen, setOfferOpen] = useState(false);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [sendingCard, setSendingCard] = useState(false);
  const { listings: activeListings } = useActiveListings({ includeOwn: true });

  // The other person's items you can make an offer on (priced, for sale),
  // with the ones already talked about in this chat first.
  const offerItems = useMemo(() => {
    const mentioned = new Set(messages.filter((m) => m.listingId).map((m) => m.listingId));
    return activeListings
      .filter((l) => l.sellerId === otherUserId && (l.type || "sell") === "sell" && l.price > 0)
      .sort((a, b) => (mentioned.has(b.id) ? 1 : 0) - (mentioned.has(a.id) ? 1 : 0));
  }, [activeListings, messages, otherUserId]);

  const openOffer = () => {
    if (offerItems.length === 0) {
      Alert.alert("No items to offer on", `${otherUserName} has no items for sale right now.`);
      return;
    }
    setOfferOpen(true);
  };

  const sendOffer = async (item, amount) => {
    setSendingCard(true);
    await sendMessage({
      type: "offer",
      text: `💸 Offer: ${peso(amount)} for "${item.name}"`,
      listingId: item.id,
      listingName: item.name || "",
      listingImage: item.images?.[0] || item.image || null,
      listingPrice: item.price || 0,
      amount,
      status: "pending",
    }, { withReply: false });
    setSendingCard(false);
    setOfferOpen(false);
  };

  const sendMeetup = async (place, date) => {
    setSendingCard(true);
    await sendMessage({
      type: "meetup",
      text: `📍 Meet-up: ${place}, ${meetupWhen(date)}`,
      place,
      at: Timestamp.fromDate(date),
      status: "pending",
      reminderSent: false,
    }, { withReply: false });
    setSendingCard(false);
    setMeetupOpen(false);
  };

  const setCardStatus = (msg, status) =>
    updateDoc(doc(db, "conversations", conversationId, "messages", msg.id), { status, respondedAt: serverTimestamp() });

  // Ids of offer / meet-up cards being answered, so a double tap can't
  // send the reply twice.
  const responding = useRef(new Set());

  const respondOffer = async (msg, accept) => {
    if (responding.current.has(msg.id)) return;
    const listing = activeListings.find((l) => l.id === msg.listingId);
    if (accept && !listing) {
      Alert.alert("No longer available", `"${msg.listingName}" has been sold or removed, so this offer can't be accepted.`);
      return;
    }
    responding.current.add(msg.id);
    try {
      await setCardStatus(msg, accept ? "accepted" : "declined");
      await sendMessage({
        type: "text",
        text: accept
          ? `✅ Accepted your offer of ${peso(msg.amount)} for "${msg.listingName}"`
          : `Sorry, I can't accept ${peso(msg.amount)} for "${msg.listingName}".`,
      }, { withReply: false });
      // Seller accepted: offer to hold the item for this buyer.
      if (accept && listing && listing.sellerId === user.uid && !listing.reserved && (listing.quantity || 1) <= 1) {
        Alert.alert("Reserve it for them?", `Hold "${msg.listingName}" for ${otherUserName} so others know it's taken.`, [
          { text: "Not now", style: "cancel" },
          {
            text: "Reserve",
            onPress: () => updateDoc(doc(db, "listings", listing.id), {
              reserved: true, reservedFor: otherUserId, reservedAt: serverTimestamp(), reserveReminderSent: false,
            }).catch(() => Alert.alert("Error", "Could not reserve the item.")),
          },
        ]);
      }
    } catch (e) {
      Alert.alert("Error", "Could not update the offer.");
    } finally {
      responding.current.delete(msg.id);
    }
  };

  const respondMeetup = async (msg, status) => {
    if (responding.current.has(msg.id)) return;
    if (status === "confirmed" && meetupPassed(msg)) {
      Alert.alert("Time has passed", "This meet-up time is already over. Plan a new one from the 📎 menu.");
      return;
    }
    responding.current.add(msg.id);
    try {
      await setCardStatus(msg, status);
      if (status === "confirmed") {
        await sendMessage({ type: "text", text: `👍 See you at ${msg.place}, ${meetupWhen(msg.at)}!` }, { withReply: false });
      } else if (status === "declined") {
        await sendMessage({ type: "text", text: "I can't make that meet-up. Can we pick another time?" }, { withReply: false });
      }
    } catch (e) {
      Alert.alert("Error", "Could not update the meet-up.");
    } finally {
      responding.current.delete(msg.id);
    }
  };

  const showMediaOptions = () => {
    Alert.alert("Send", "Choose what to send", [
      { text: "Take Photo/Video", icon: "camera", onPress: () => pickMedia("camera") },
      { text: `Choose from Gallery (up to ${MAX_MEDIA})`, icon: "images", onPress: () => pickMedia("gallery") },
      { text: "Make an Offer", icon: "pricetag", onPress: openOffer },
      { text: "Plan a Meet-up", icon: "location", onPress: () => setMeetupOpen(true) },
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

  // Offer / meet-up card: summary, status, and the buttons that apply to you.
  const renderActionCard = (msg, isMe) => {
    const isOffer = msg.type === "offer";
    const passed = meetupPassed(msg);
    const st = passed ? MEETUP_STATUS.passed : (isOffer ? OFFER_STATUS : MEETUP_STATUS)[msg.status] || (isOffer ? OFFER_STATUS : MEETUP_STATUS).pending;
    const toneColor = { warning: COLORS.warning, primary: COLORS.primary, error: COLORS.error, muted: COLORS.textMuted }[st.tone];
    const pending = (msg.status === "pending" || !msg.status) && !passed;
    return (
      <View>
        <View style={[styles.cardHead, { backgroundColor: isOffer ? COLORS.warningLight : COLORS.infoLight }]}>
          <Ionicons name={isOffer ? "pricetag" : "location"} size={16} color={isOffer ? COLORS.warning : COLORS.info} />
          <Text style={[styles.cardHeadText, { color: isOffer ? COLORS.warning : COLORS.info }]}>
            {isOffer ? (isMe ? "Your offer" : `${otherUserName.split(" ")[0]}'s offer`) : (isMe ? "You proposed a meet-up" : "Meet-up request")}
          </Text>
        </View>
        {isOffer ? (
          <TouchableOpacity style={styles.actionBody} activeOpacity={0.85} onPress={() => navigation.navigate("ProductDetail", { id: msg.listingId })}>
            <View style={styles.offerRow}>
              {msg.listingImage ? <CachedImage source={{ uri: msg.listingImage }} style={styles.offerThumb} contentFit="cover" cachePolicy="memory-disk" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{msg.listingName}</Text>
                <Text style={styles.offerAsking}>Asking {peso(msg.listingPrice)}</Text>
              </View>
            </View>
            <Text style={styles.offerAmount}>{peso(msg.amount)}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionBody}>
            <Text style={styles.cardName}>{msg.place}</Text>
            <View style={styles.meetupWhenRow}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.meetupWhen}>{meetupWhen(msg.at)}</Text>
            </View>
          </View>
        )}
        <View style={styles.cardStatus}>
          <Ionicons name={st.icon} size={14} color={toneColor} />
          <Text style={[styles.cardStatusText, { color: toneColor }]}>{st.label}</Text>
          <Text style={styles.cardTime}>{timeLabel(msg.createdAt)}</Text>
        </View>
        {pending ? (
          <View style={styles.cardActions}>
            {isMe ? (
              <TouchableOpacity style={[styles.cardBtn, styles.cardBtnGhost]} onPress={() => setCardStatus(msg, isOffer ? "withdrawn" : "cancelled").catch(() => {})}>
                <Text style={styles.cardBtnGhostText}>{isOffer ? "Withdraw" : "Cancel"}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[styles.cardBtn, styles.cardBtnGhost]} onPress={() => (isOffer ? respondOffer(msg, false) : respondMeetup(msg, "declined"))}>
                  <Text style={styles.cardBtnGhostText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cardBtn, { backgroundColor: COLORS.primary }]} onPress={() => (isOffer ? respondOffer(msg, true) : respondMeetup(msg, "confirmed"))}>
                  <Text style={styles.cardBtnText}>{isOffer ? "Accept" : "Confirm"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
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
            (msg.type === "listing" || msg.type === "offer" || msg.type === "meetup") && styles.msgBubbleCard,
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

            {msg.type === "offer" || msg.type === "meetup" ? (
              renderActionCard(msg, isMe)
            ) : msg.type === "listing" ? (
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
      <View ref={tourOriginRef} collapsable={false} pointerEvents="none" style={styles.tourOrigin} />
      <CoachMark visible={tourVisible} steps={tourSteps} onFinish={finishTour} originRef={tourOriginRef} />
      <StatusBar barStyle={COLORS.statusBar} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn} activeOpacity={0.7} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Main", { screen: "Messages" }); }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          ref={headerInfoRef}
          collapsable={false}
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
          <TouchableOpacity ref={attachRef} collapsable={false} accessibilityRole="button" accessibilityLabel="Send photos, an offer or a meet-up" style={styles.mediaBtn} activeOpacity={0.7} onPress={showMediaOptions}>
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
      <OfferSheet visible={offerOpen} onClose={() => setOfferOpen(false)} items={offerItems} onSend={sendOffer} sending={sendingCard} />
      <MeetupSheet visible={meetupOpen} onClose={() => setMeetupOpen(false)} onSend={sendMeetup} sending={sendingCard} />
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
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  cardHeadText: { fontSize: 12.5, fontWeight: "800" },
  actionBody: { paddingHorizontal: 12, paddingTop: 10, gap: 4 },
  offerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  offerThumb: { width: 40, height: 40, borderRadius: 8 },
  offerAsking: { fontSize: 12, color: COLORS.textMuted, textDecorationLine: "line-through" },
  offerAmount: { fontSize: 24, fontFamily: FONTS.heading, color: COLORS.primary, marginTop: 4 },
  meetupWhenRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meetupWhen: { fontSize: 13.5, color: COLORS.textSecondary, fontWeight: "600" },
  cardStatus: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  cardStatusText: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  cardTime: { fontSize: 10, color: COLORS.textMuted },
  cardActions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  cardBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardBtnGhost: { backgroundColor: COLORS.surfaceAlt },
  cardBtnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
  cardBtnGhostText: { color: COLORS.textSecondary, fontWeight: "700", fontSize: 13.5 },
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
  tourOrigin: { position: "absolute", top: 0, left: 0, width: 1, height: 1 },
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
