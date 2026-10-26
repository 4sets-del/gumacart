// The v1 API keeps the existing deployed (1st gen) functions as they are.
const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const NOTIF_STYLES = {
  message:  { channelId: "default", color: "#2980b9", titlePrefix: "💬 " },
  review:   { channelId: "default", color: "#F4C542", titlePrefix: "⭐ " },
  verified: { channelId: "default", color: "#2E6B3E", titlePrefix: "✅ " },
  rejected: { channelId: "default", color: "#e74c3c", titlePrefix: "⚠️ " },
  system:   { channelId: "default", color: "#9b59b6", titlePrefix: "📢 " },
  banned:   { channelId: "account", color: "#e74c3c", titlePrefix: "🚫 " },
  appeal:   { channelId: "account", color: "#2E6B3E", titlePrefix: "📩 " },
  report:   { channelId: "account", color: "#e67e22", titlePrefix: "🚩 " },
};

// Sends push messages through Expo and returns the tokens Expo reports as
// no longer valid (app uninstalled, or the token was replaced).
async function sendExpoPush(messages) {
  if (!messages.length) return [];
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    if (result.errors) console.error("Expo push errors:", JSON.stringify(result.errors));
    const tickets = Array.isArray(result.data) ? result.data : [];
    return tickets
      .map((ticket, i) => (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
      .filter(Boolean);
  } catch (e) {
    console.error("Expo push error:", e.message);
    return [];
  }
}

// Sends straight through Firebase Cloud Messaging to phones that registered
// an FCM token (APKs from 2026-10-26 on). These are data-only messages in the
// format the app's notification library reads (title / message / body = JSON
// of the data), so the app draws the notification itself:
//  - `tag` is its id, so a new message from the same chat replaces the card;
//  - `image` (patches/expo-notifications…) is the round picture beside the
//    text, which stays put when the card is expanded to show every line.
// Expo's push service drops both. Returns tokens FCM reports as invalid.
async function sendFcmPush(tokens, { title, body, data, tag, image, channelId, color }) {
  const payload = {
    title, message: body, body: JSON.stringify(data || {}), channelId, color,
    ...(tag ? { tag } : {}),
    ...(image ? { image } : {}),
  };
  const messages = tokens.map((token) => ({ token, data: payload, android: { priority: "high" } }));
  try {
    const res = await getMessaging().sendEach(messages);
    return res.responses
      .map((r, i) => {
        const code = r.error?.code;
        return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
          ? tokens[i] : null;
      })
      .filter(Boolean);
  } catch (e) {
    console.error("FCM push error:", e.message);
    return [];
  }
}

// `image`: a person's profile photo URL (or letter avatar), shown as the
// picture on the notification.
async function notifyUser(userId, { storeType, styleKey, title, body, data, groupTag, collapseKey, image }) {
  const style = NOTIF_STYLES[styleKey] || NOTIF_STYLES.system;
  const notifCol = db.collection("users").doc(userId).collection("notifications");

  if (collapseKey) {
    const existing = await notifCol.where("collapseKey", "==", collapseKey).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({
        title, body, read: false,
        ...(data || {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      await notifCol.add({
        type: storeType, title, body, read: false, collapseKey,
        ...(data || {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    await notifCol.add({
      type: storeType, title, body, read: false,
      ...(data || {}),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // One read for both the push tokens and the user's notification settings.
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) return;
  const userData = userSnap.data();
  const tokens = Array.isArray(userData.pushTokens) ? userData.pushTokens : [];
  const fcmTokens = Array.isArray(userData.fcmTokens) ? userData.fcmTokens : [];
  if (!tokens.length && !fcmTokens.length) return;

  // Settings → Notifications. Muted types are still saved to the in-app list
  // above; only the phone push is skipped.
  const prefs = userData.notifPrefs || {};
  if (prefs.muteAll === true) return;
  if (storeType === "search_alert" && prefs.alerts === false) return;
  if (storeType !== "search_alert" && data?.nav === "listing" && prefs.listings === false) return;
  if (storeType === "message" && prefs.messages === false) return;
  if (storeType === "review" && prefs.reviews === false) return;

  // Phones on a current APK register both tokens; FCM is used for them so
  // nothing arrives twice. Expo push remains for older APKs.
  if (fcmTokens.length) {
    const dead = await sendFcmPush(fcmTokens, {
      title: style.titlePrefix + title, body, data: { type: storeType, ...(data || {}) },
      tag: groupTag, image, channelId: style.channelId, color: style.color,
    });
    if (dead.length) {
      await db.collection("users").doc(userId).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
    }
    return;
  }

  const messages = tokens.map((token) => {
    const msg = {
      to: token,
      sound: "default",
      priority: "high",
      title: style.titlePrefix + title,
      body,
      data: { type: storeType, ...(data || {}) },
      channelId: style.channelId,
      badge: 1,
    };
    if (image) msg.richContent = { image };
    if (groupTag) {
      msg.tag = groupTag;
      msg._displayInForeground = true;
    }
    return msg;
  });

  const deadTokens = await sendExpoPush(messages);
  if (deadTokens.length) {
    await db.collection("users").doc(userId).update({ pushTokens: FieldValue.arrayRemove(...deadTokens) });
  }
}

// Letter avatars on Firebase Hosting (scripts/make-avatars.sh), for people
// without a profile photo: the first letter of their name in the same color
// the app gives them (colorForName / ACCENTS in constants/theme.js).
const AVATAR_BASE = "https://gumacartfinal.web.app/avatars";
const AVATAR_COLORS = 8;

function letterAvatar(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const initial = (name.trim()[0] || "").toUpperCase();
  const file = /^[A-Z0-9]$/.test(initial) ? initial : "other";
  return `${AVATAR_BASE}/${Math.abs(hash) % AVATAR_COLORS}/${file}.png`;
}

// A user's profile photo URL, or their letter avatar, for notification pictures.
async function photoOf(uid) {
  if (!uid) return undefined;
  try {
    const user = await db.collection("users").doc(uid).get();
    return user.get("photoURL") || letterAvatar(user.get("name") || "");
  } catch (e) {
    return undefined;
  }
}

function suspensionPhrase(bannedUntil) {
  if (!bannedUntil) return "Your account has been permanently suspended by an admin.";
  const until = bannedUntil.toDate ? bannedUntil.toDate() : new Date(bannedUntil);
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "Your account was suspended by an admin.";
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `Your account has been suspended for about ${hours} hour(s).`;
  const days = Math.round(hours / 24);
  return `Your account has been suspended for about ${days} day(s).`;
}

// One line describing a chat message, for notifications.
function messagePreview(m) {
  return (
    m.type === "listing" ? `🛍️ Interested in "${m.listingName || "your listing"}"`
    : m.type === "image" ? "📷 Sent a photo"
    : m.type === "video" ? "🎥 Sent a video"
    : m.type === "audio" ? "🎤 Sent a voice message"
    : m.text || "Sent you a message"
  ).slice(0, 100);
}

exports.onNewMessage = functions
  .region("asia-southeast1")
  .firestore
  .document("conversations/{convId}/messages/{msgId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const senderId = message.senderId;
    if (!senderId) return null;

    const convSnap = await db.collection("conversations").doc(context.params.convId).get();
    if (!convSnap.exists) return null;

    const participants = convSnap.data().participants || [];
    const recipientId = participants.find((id) => id !== senderId);
    if (!recipientId) return null;

    // No notification if the recipient blocked the sender.
    const blocked = await db.collection("users").doc(recipientId).collection("blocked").doc(message.senderId).get();
    if (blocked.exists) return null;

    const senderName = message.senderName || "Someone";

    // Messenger-style stacking: show every message from this person that the
    // recipient hasn't read yet (up to 5) in one notification. It uses the
    // same tag per chat, so each new message replaces the previous card
    // instead of adding another one. Stops at the recipient's last reply or
    // the last time they opened the chat.
    const conv = convSnap.data();
    const lastReadMs = conv.lastReadAt?.[recipientId]?.toMillis?.() || 0;
    const recent = await db.collection("conversations").doc(context.params.convId).collection("messages")
      .orderBy("createdAt", "desc").limit(12).get();
    const unread = [];
    for (const d of recent.docs) {
      const m = d.data();
      const ms = m.createdAt?.toMillis?.() || Date.now();
      if (m.senderId === recipientId || (lastReadMs && ms <= lastReadMs)) break;
      if (m.senderId === senderId) unread.push({ id: d.id, ...m });
    }
    if (!unread.some((m) => m.id === context.params.msgId)) {
      unread.unshift({ id: context.params.msgId, ...message }); // in case it isn't in the query yet
    }
    // Reply speed: if this message answers the other person's last message,
    // record how long the sender took (shown as "Usually replies within …").
    // Gaps over 3 days don't count (the chat had gone quiet), and each one is
    // capped at a day so one slow reply doesn't dominate.
    const prev = recent.docs.find((d) => d.id !== context.params.msgId);
    const prevMs = prev?.get("createdAt")?.toMillis?.();
    const nowMs = message.createdAt?.toMillis?.() || Date.now();
    if (prev && prev.get("senderId") === recipientId && prevMs && nowMs - prevMs < 3 * DAY) {
      await db.collection("replyStats").doc(senderId).set({
        replies: FieldValue.increment(1),
        totalMs: FieldValue.increment(Math.min(nowMs - prevMs, DAY)),
      }, { merge: true }).catch(() => {});
    }

    const lines = unread.slice(0, 5).reverse().map((m) => messagePreview(m));
    const extra = unread.length > 5 ? `+${unread.length - 5} more\n` : "";

    await notifyUser(recipientId, {
      storeType: "message",
      styleKey: "message",
      title: unread.length > 1 ? `${senderName} (${unread.length} new messages)` : senderName,
      body: (extra + lines.join("\n")).slice(0, 600),
      data: { nav: "chat", conversationId: context.params.convId },
      groupTag: "chat_" + context.params.convId,
      collapseKey: "chat_" + context.params.convId,
      image: await photoOf(message.senderId),
    });
    return null;
  });

exports.onNewReview = functions
  .region("asia-southeast1")
  .firestore
  .document("reviews/{reviewId}")
  .onCreate(async (snap) => {
    const review = snap.data();
    const sellerId = review.sellerId;
    if (!sellerId) return null;
    const reviewerName = review.reviewerName || "Someone";
    const stars = review.rating ? "★".repeat(review.rating) : "";
    const body = review.comment
      ? `${reviewerName}: "${String(review.comment).slice(0, 80)}"`
      : `${reviewerName} rated you ${review.rating || ""} stars`;
    await notifyUser(sellerId, {
      storeType: "review",
      styleKey: "review",
      title: stars ? `New review ${stars}` : "New review",
      body,
      data: { nav: "self" },
      image: await photoOf(review.reviewerId),
    });
    return null;
  });

exports.onUserDocUpdate = functions
  .region("asia-southeast1")
  .firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const prevV = before.verificationStatus;
    const nextV = after.verificationStatus;
    if (prevV !== nextV && (nextV === "verified" || nextV === "rejected")) {
      if (nextV === "verified") {
        await notifyUser(context.params.userId, {
          storeType: "sold",
          styleKey: "verified",
          title: "You're verified!",
          body: "Your SLSU student ID was approved. You can now post listings.",
          data: { nav: "self" },
        });
      } else {
        const reason = after.rejectionReason || after.verification?.reason;
        await notifyUser(context.params.userId, {
          storeType: "system",
          styleKey: "rejected",
          title: "Verification not approved",
          body: reason
            ? `${reason} Please re-submit your verification.`
            : "Your ID couldn't be verified. Please re-submit a clearer photo.",
          data: { nav: "verification" },
        });
      }
    }

    const prevR = before.role;
    const nextR = after.role;
    if (prevR !== nextR) {
      if (nextR === "banned") {
        const phrase = suspensionPhrase(after.bannedUntil);
        const reasonPart = after.banReason ? ` Reason: ${after.banReason}.` : "";
        await notifyUser(context.params.userId, {
          storeType: "system",
          styleKey: "banned",
          title: "Account suspended",
          body: `${phrase}${reasonPart} Open the app to submit an appeal.`,
          data: { nav: "self" },
        });
      } else if (prevR === "banned" && nextR !== "banned") {
        await notifyUser(context.params.userId, {
          storeType: "sold",
          styleKey: "appeal",
          title: "Account restored",
          body: "Your account access has been restored. Welcome back!",
          data: { nav: "self" },
        });
      }
    }

    const prevF = before.facultyRequest;
    const nextF = after.facultyRequest;
    if (prevF !== nextF) {
      if (nextF === "approved") {
        await notifyUser(context.params.userId, {
          storeType: "sold",
          styleKey: "verified",
          title: "Faculty status approved",
          body: "You're now a verified faculty member on SLSU-GumaCart.",
          data: { nav: "self" },
        });
      } else if (nextF === "rejected") {
        await notifyUser(context.params.userId, {
          storeType: "system",
          styleKey: "rejected",
          title: "Faculty request declined",
          body: "Your faculty request was not approved. You can request again from your profile.",
          data: { nav: "self" },
        });
      }
    }
    return null;
  });

// Ids of people interested in a listing (see listings/{id}/interested).
async function interestedIds(listingId) {
  const snap = await db.collection("listings").doc(listingId).collection("interested").get();
  return snap.docs.map((d) => d.id);
}

// Same word rule as utils/searchAlerts.js in the app.
function keywordsOf(text) {
  const words = String(text || "").toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  return [...new Set(words)];
}

// "Notify me" saved searches: tell everyone whose saved search matches a
// listing that just went live (every word of the search must appear).
async function notifySearchAlerts(listingId, listing) {
  const words = keywordsOf(`${listing.name || listing.title || ""} ${listing.description || ""} ${listing.category || ""}`);
  if (!words.length) return;
  const wordSet = new Set(words);
  const matches = new Map(); // uid -> saved search term
  // array-contains-any accepts up to 30 values per query.
  for (let i = 0; i < words.length; i += 30) {
    const snap = await db.collectionGroup("savedSearches")
      .where("keywords", "array-contains-any", words.slice(i, i + 30))
      .get();
    for (const d of snap.docs) {
      const uid = d.ref.parent.parent.id;
      const s = d.data();
      if (uid === listing.sellerId || matches.has(uid)) continue;
      if ((s.keywords || []).every((w) => wordSet.has(w))) matches.set(uid, s.term);
    }
  }
  const itemName = listing.name || listing.title || "A new item";
  await Promise.all([...matches].map(([uid, term]) => notifyUser(uid, {
    storeType: "search_alert",
    styleKey: "system",
    title: `New match for "${term}"`,
    body: `"${itemName}" was just posted. Tap to see it before someone else does.`,
    data: { nav: "listing", listingId },
  })));
}

exports.onListingStatusChange = functions
  .region("asia-southeast1")
  .firestore
  .document("listings/{listingId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const listingId = context.params.listingId;
    const sellerId = after.sellerId;
    if (!sellerId) return null;

    const statusChanged = before.status !== after.status;
    const wasReserved = before.reserved === true;
    const isReserved = after.reserved === true;
    const becameReserved = isReserved && !wasReserved;
    const reassigned = isReserved && wasReserved && before.reservedFor !== after.reservedFor;
    const released = wasReserved && !isReserved && after.status === "active";
    const newSale = !!after.lastSaleAt && !(before.lastSaleAt && before.lastSaleAt.isEqual(after.lastSaleAt));
    const priceDropped = after.status === "active" && typeof before.price === "number"
      && typeof after.price === "number" && after.price < before.price;
    // Most updates (e.g. view counts) change none of these; stop early.
    if (!statusChanged && !becameReserved && !reassigned && !released && !newSale && !priceDropped) return null;

    const itemName = after.name || after.title || "your listing";
    const sellerName = after.sellerName || "the seller";
    const listingLink = { nav: "listing", listingId };
    const notifyListing = (uid, title, body) => notifyUser(uid, {
      storeType: "listing_update", styleKey: "system", title, body, data: listingLink,
    });
    // A sale to a specific buyer is recorded (deals/{id}) and the buyer is
    // invited to rate. Only buyers with a recorded sale can rate a seller, so
    // reviews come from real deals.
    const ratePrompt = async (buyerId) => {
      const buyer = (await db.collection("users").doc(buyerId).get()).data() || {};
      await db.collection("deals").add({
        listingId,
        listingName: itemName,
        listingImage: (after.images && after.images[0]) || after.image || null,
        price: after.type === "sell" ? (after.price || 0) : 0,
        type: after.type || "sell",
        sellerId, sellerName,
        buyerId, buyerName: buyer.name || "Buyer",
        status: "completed",
        createdAt: FieldValue.serverTimestamp(),
      });
      await notifyUser(buyerId, {
        storeType: "rate_prompt",
        styleKey: "review",
        title: "How was your purchase?",
        body: `You got "${itemName}" from ${sellerName}. Tap to leave a rating.`,
        data: { nav: "profile", profileId: sellerId, profileName: sellerName, rate: "1" },
      });
    };

    if (statusChanged && before.status === "pending" && after.status === "active") {
      await notifyUser(sellerId, {
        storeType: "sold",
        styleKey: "verified",
        title: "Listing approved",
        body: `"${itemName}" is now live on the marketplace.`,
        data: listingLink,
      });
      // Only the first time it goes live (edits are re-approved too).
      if (!after.alertsSent) {
        await notifySearchAlerts(listingId, after).catch((e) => console.error("Search alerts", e.message));
        await change.after.ref.update({ alertsSent: true });
      }
    }

    // Price drop: tell everyone who saved it (wishlists/{uid}/items/{id}).
    if (priceDropped) {
      const savers = await db.collectionGroup("items").where("listingId", "==", listingId).get();
      const peso = (n) => `₱${Number(n).toLocaleString()}`;
      await Promise.all(savers.docs
        .map((d) => d.ref.parent.parent.id)
        .filter((uid) => uid !== sellerId)
        .map((uid) => notifyUser(uid, {
          storeType: "price_drop", styleKey: "system",
          title: "Price drop on a saved item",
          body: `"${itemName}" is now ${peso(after.price)} (was ${peso(before.price)}).`,
          data: listingLink,
        })));
    }

    if (statusChanged && after.status === "rejected") {
      await notifyUser(sellerId, {
        storeType: "system",
        styleKey: "rejected",
        title: "Listing not approved",
        body: `"${itemName}" was not approved. Tap to edit and re-submit.`,
        data: { ...listingLink, edit: "1" },
      });
    }

    // One unit of a multi-quantity listing sold: invite that buyer to rate.
    if (newSale && after.lastSaleTo && after.lastSaleTo !== sellerId) {
      await ratePrompt(after.lastSaleTo);
    }

    if (statusChanged && after.status === "sold") {
      // The buyer rates the seller; everyone else who was interested is told
      // it's gone.
      if (after.soldTo && after.soldTo !== sellerId) await ratePrompt(after.soldTo);
      const others = (await interestedIds(listingId)).filter((uid) => uid !== after.soldTo && uid !== sellerId);
      await Promise.all(others.map(async (uid) => {
        await notifyListing(uid, "Item sold", `Sorry, "${itemName}" has been sold.`);
      }));
      return null;
    }

    if (becameReserved || reassigned) {
      const buyer = after.reservedFor;
      if (buyer && buyer !== sellerId) {
        await notifyListing(buyer, "Reserved for you", `${sellerName} reserved "${itemName}" for you. Message them to arrange the meet-up.`);
      }
      if (becameReserved) {
        const others = (await interestedIds(listingId)).filter((uid) => uid !== buyer && uid !== sellerId);
        await Promise.all(others.map((uid) => notifyListing(uid, "Item reserved",
          `"${itemName}" was reserved by another buyer. We'll let you know if it becomes available again.`)));
      }
    }

    if (released) {
      const everyone = (await interestedIds(listingId)).filter((uid) => uid !== sellerId);
      await Promise.all(everyone.map((uid) => notifyListing(uid, "Available again",
        `Good news! "${itemName}" is available again.`)));
    }
    return null;
  });

// A deleted listing's interested-buyer entries go with it.
exports.onListingDeleted = functions
  .region("asia-southeast1")
  .firestore
  .document("listings/{listingId}")
  .onDelete(async (snap) => {
    await db.recursiveDelete(snap.ref.collection("interested"));
    return null;
  });

// Reservations shouldn't hang forever: after 48h remind the seller, after
// 96h release it automatically (onListingStatusChange then tells the
// interested buyers it's available again).
exports.checkReservations = functions
  .region("asia-southeast1")
  .pubsub.schedule("every 6 hours")
  .timeZone("Asia/Manila")
  .onRun(async () => {
    const snap = await db.collection("listings").where("reserved", "==", true).get();
    const now = Date.now();
    for (const doc of snap.docs) {
      const d = doc.data();
      const at = d.reservedAt?.toMillis?.();
      if (d.status !== "active" || !at || !d.sellerId) continue;
      const itemName = d.name || d.title || "your listing";
      const link = { nav: "listing", listingId: doc.id };
      const age = now - at;
      if (age >= 96 * HOUR) {
        await doc.ref.update({ reserved: false, reservedFor: null, reservedAt: null });
        await notifyUser(d.sellerId, {
          storeType: "listing_update", styleKey: "system", data: link,
          title: "Reservation released",
          body: `"${itemName}" was reserved for 4 days, so it's available again. Interested buyers were notified.`,
        });
      } else if (age >= 48 * HOUR && !d.reserveReminderSent) {
        await doc.ref.update({ reserveReminderSent: true });
        await notifyUser(d.sellerId, {
          storeType: "listing_update", styleKey: "system", data: link,
          title: "Still reserved?",
          body: `"${itemName}" has been reserved for 2 days. Mark it sold or release it; otherwise it's released automatically in 2 days.`,
        });
      }
    }
    return null;
  });

// Listing expiry: active listings older than 30 days are hidden (status
// "expired") so Home doesn't fill up with stale items; the seller gets a
// heads-up 3 days before and can Renew from the listing. Reserved items are
// left alone while a sale is in progress. Runs daily.
exports.expireListings = functions
  .region("asia-southeast1")
  .pubsub.schedule("every day 09:00")
  .timeZone("Asia/Manila")
  .onRun(async () => {
    const now = Date.now();
    const snap = await db.collection("listings")
      .where("status", "==", "active")
      .where("createdAt", "<", new Date(now - 27 * DAY))
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.reserved || !d.sellerId) continue;
      const itemName = d.name || d.title || "your listing";
      const link = { nav: "listing", listingId: doc.id };
      if (d.createdAt.toMillis() < now - 30 * DAY) {
        await doc.ref.update({ status: "expired", expiredAt: FieldValue.serverTimestamp() });
        await notifyUser(d.sellerId, {
          storeType: "listing_expired", styleKey: "system", data: link,
          title: "Listing expired",
          body: `"${itemName}" was up for 30 days and is now hidden. Still available? Tap to renew it.`,
        });
      } else if (!d.expiryWarned) {
        await doc.ref.update({ expiryWarned: true });
        await notifyUser(d.sellerId, {
          storeType: "listing_expired", styleKey: "system", data: link,
          title: "Expiring in 3 days",
          body: `"${itemName}" will be hidden soon. Sold it? Mark it sold. Still selling? Renew it from the listing.`,
        });
      }
    }
    return null;
  });

// Settings → Send Feedback: let the admins know something arrived.
exports.onFeedbackCreated = functions
  .region("asia-southeast1")
  .firestore
  .document("feedback/{feedbackId}")
  .onCreate(async (snap) => {
    const f = snap.data();
    const admins = await db.collection("users").where("role", "==", "admin").get();
    const kind = f.type === "bug" ? "Problem report" : f.type === "idea" ? "Suggestion" : "Feedback";
    await Promise.all(admins.docs.map((d) => notifyUser(d.id, {
      storeType: "system", styleKey: "system",
      title: `${kind} from ${f.userName || "a user"}`,
      body: String(f.message || "").slice(0, 120),
      data: { nav: "admin", tab: "insights" },
    })));
    return null;
  });

exports.onAppealResolved = functions
  .region("asia-southeast1")
  .firestore
  .document("appeals/{appealId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return null;
    if (after.status !== "rejected") return null;
    if (!after.userId) return null;

    await notifyUser(after.userId, {
      storeType: "system",
      styleKey: "banned",
      title: "Appeal declined",
      body: "Your appeal was reviewed and declined. Your account remains suspended. You may submit another appeal.",
      data: { nav: "self" },
    });
    return null;
  });

// When an admin resolves a report: tell the reporter how it went, and (for
// warnings / deleted messages) tell the reported user which message it was
// and how to respond. Suspensions are announced by onUserDocUpdate.
function reportedMessageSummary(m) {
  if (!m) return "a message";
  if (m.type === "image") return "a photo";
  if (m.type === "video") return "a video";
  if (m.type === "audio") return "a voice message";
  const text = String(m.text || "").trim();
  return text ? `"${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"` : "a message";
}

exports.onReportResolved = functions
  .region("asia-southeast1")
  .firestore
  .document("reports/{reportId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return null;
    if (after.status !== "resolved" && after.status !== "dismissed") return null;

    const targetName = after.kind === "listing"
      ? (after.listingName || "a listing")
      : after.kind === "message"
        ? `a message from ${after.reportedUserName || "a user"}`
        : (after.reportedUserName || "a user");

    if (after.reporterId) {
      const body = after.status === "resolved"
        ? `Your report about ${targetName} was reviewed and action was taken. Thank you.`
        : after.dismissKind === "false"
          ? `Your report about ${targetName} was reviewed and didn't break the rules. Please only report real problems; repeated false reports can get your account restricted.`
          : `Your report about ${targetName} was reviewed. No action was needed.`;
      await notifyUser(after.reporterId, {
        storeType: "system", styleKey: "report", title: "Report reviewed", body, data: { nav: "self" },
      });
    }

    // Warnings: the reported person learns which message and why, with a way
    // to respond (Settings → Send Feedback) if they think it's a mistake.
    if (after.kind === "message" && after.reportedUserId && (after.action === "warn" || after.action === "delete")) {
      const what = reportedMessageSummary(after.message);
      await notifyUser(after.reportedUserId, {
        storeType: "system", styleKey: "report",
        title: after.action === "delete" ? "A message was removed" : "Warning about a message",
        body: `${what} was reported for ${String(after.reason || "breaking the rules").toLowerCase()}${after.action === "delete" ? " and removed by an admin" : ""}. Please keep chats respectful; repeated reports can lead to suspension. Think this is a mistake? Tell us in Settings → Send Feedback.`,
        data: { nav: "self" },
      });
    }
    return null;
  });

// Keeps each seller's avgRating / totalReviews in sync with their actual
// reviews whenever a review is added, edited or deleted. Calculating it here
// (instead of on the reviewer's phone) avoids drift from simultaneous reviews.
exports.onReviewWrite = functions
  .region("asia-southeast1")
  .firestore
  .document("reviews/{reviewId}")
  .onWrite(async (change) => {
    const sellerIds = new Set(
      [change.before.data()?.sellerId, change.after.data()?.sellerId].filter(Boolean),
    );
    for (const sellerId of sellerIds) {
      const snap = await db.collection("reviews").where("sellerId", "==", sellerId).get();
      const ratings = snap.docs.map((d) => Number(d.data().rating)).filter((r) => r >= 1 && r <= 5);
      const total = ratings.length;
      const avg = total ? Math.round((ratings.reduce((a, b) => a + b, 0) / total) * 10) / 10 : 0;
      await db.collection("users").doc(sellerId).set({ avgRating: avg, totalReviews: total }, { merge: true });
    }
    return null;
  });

// Removes everything belonging to a user. Conversations are kept so the
// other participant still has their chat history.
async function deleteUserData(uid) {
  const userRef = db.collection("users").doc(uid);

  // Follow links from the old follow feature, stored on the other side of
  // each relationship (older accounts may still have them).
  const [following, followers] = await Promise.all([
    userRef.collection("following").get(),
    userRef.collection("followers").get(),
  ]);
  await Promise.all([
    ...following.docs.map((d) => db.collection("users").doc(d.id).collection("followers").doc(uid).delete()),
    ...followers.docs.map((d) => db.collection("users").doc(d.id).collection("following").doc(uid).delete()),
  ]);

  // Their listings, and reviews they wrote or received. Deleting reviews
  // triggers onReviewWrite, which updates the affected sellers' ratings.
  const [listings, written, received] = await Promise.all([
    db.collection("listings").where("sellerId", "==", uid).get(),
    db.collection("reviews").where("reviewerId", "==", uid).get(),
    db.collection("reviews").where("sellerId", "==", uid).get(),
  ]);
  await Promise.all([...listings.docs, ...written.docs, ...received.docs].map((d) => d.ref.delete()));

  // Profile document plus its notifications, saved searches, blocked list
  // and any old cart / follow data; and their saved items (wishlist).
  await db.recursiveDelete(userRef);
  await db.recursiveDelete(db.collection("wishlists").doc(uid));

  // Uploaded files: profile photo, listing photos and student ID.
  const bucket = getStorage().bucket();
  await Promise.all(
    [`profiles/${uid}/`, `listings/${uid}/`, `verifications/${uid}/`].map((prefix) =>
      bucket.deleteFiles({ prefix }).catch((e) => console.error("Storage cleanup", prefix, e.message)),
    ),
  );
}

// When an account is deleted (Settings → Delete Account, or an admin
// deleting a user), remove that person's data.
exports.onAccountDeleted = functions
  .region("asia-southeast1")
  .auth.user()
  .onDelete(async (user) => {
    await deleteUserData(user.uid);
    return null;
  });

// Admin Panel → Delete user. Deleting the login triggers onAccountDeleted,
// which cleans up their data; if the login is already gone, clean up here.
exports.adminDeleteUser = functions
  .region("asia-southeast1")
  .https.onCall(async (data, context) => {
    const callerId = context.auth?.uid;
    if (!callerId) throw new functions.https.HttpsError("unauthenticated", "Sign in first.");
    const caller = await db.collection("users").doc(callerId).get();
    if (caller.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can delete users.");
    }
    const uid = data?.uid;
    if (!uid || typeof uid !== "string") throw new functions.https.HttpsError("invalid-argument", "Missing user id.");
    if (uid === callerId) throw new functions.https.HttpsError("failed-precondition", "You can't delete your own account here.");

    try {
      await getAuth().deleteUser(uid);
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw new functions.https.HttpsError("internal", e.message);
      await deleteUserData(uid);
    }
    return { ok: true };
  });
