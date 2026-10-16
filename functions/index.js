const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const NOTIF_STYLES = {
  message:  { channelId: "default", color: "#2980b9", titlePrefix: "💬 " },
  follow:   { channelId: "default", color: "#2E6B3E", titlePrefix: "👤 " },
  review:   { channelId: "default", color: "#F4C542", titlePrefix: "⭐ " },
  verified: { channelId: "default", color: "#2E6B3E", titlePrefix: "✅ " },
  rejected: { channelId: "default", color: "#e74c3c", titlePrefix: "⚠️ " },
  system:   { channelId: "default", color: "#9b59b6", titlePrefix: "📢 " },
  banned:   { channelId: "account", color: "#e74c3c", titlePrefix: "🚫 " },
  appeal:   { channelId: "account", color: "#2E6B3E", titlePrefix: "📩 " },
  report:   { channelId: "account", color: "#e67e22", titlePrefix: "🚩 " },
};

async function sendExpoPush(messages) {
  if (!messages.length) return;
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
  } catch (e) {
    console.error("Expo push error:", e.message);
  }
}

async function tokensForUser(userId) {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return [];
  const data = snap.data();
  return Array.isArray(data.pushTokens) ? data.pushTokens : [];
}

async function notifyUser(userId, { storeType, styleKey, title, body, data, groupTag, collapseKey }) {
  const style = NOTIF_STYLES[styleKey] || NOTIF_STYLES.system;
  const notifCol = db.collection("users").doc(userId).collection("notifications");

  if (collapseKey) {
    const existing = await notifCol.where("collapseKey", "==", collapseKey).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({
        title, body, read: false,
        ...(data || {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await notifCol.add({
        type: storeType, title, body, read: false, collapseKey,
        ...(data || {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else {
    await notifCol.add({
      type: storeType, title, body, read: false,
      ...(data || {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const tokens = await tokensForUser(userId);
  if (!tokens.length) return;

  try {
    const prefSnap = await db.collection("users").doc(userId).get();
    const prefs = prefSnap.data()?.notifPrefs || {};
    if (storeType === "message" && prefs.messages === false) return;
    if (storeType === "follow" && prefs.followers === false) return;
    if (storeType === "review" && prefs.reviews === false) return;
  } catch (e) {}

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
    if (groupTag) {
      msg.tag = groupTag;
      msg._displayInForeground = true;
    }
    return msg;
  });

  await sendExpoPush(messages);
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

    const senderName = message.senderName || "Someone";
    const preview = (message.text || "Sent you a message").slice(0, 100);

    await notifyUser(recipientId, {
      storeType: "message",
      styleKey: "message",
      title: senderName,
      body: preview,
      data: { nav: "chat", conversationId: context.params.convId },
      groupTag: "chat_" + context.params.convId,
      collapseKey: "chat_" + context.params.convId,
    });
    return null;
  });

exports.onNewFollower = functions
  .region("asia-southeast1")
  .firestore
  .document("users/{userId}/followers/{followerId}")
  .onCreate(async (snap, context) => {
    const follower = snap.data();
    const followerName = follower.name || "Someone";
    await notifyUser(context.params.userId, {
      storeType: "follow",
      styleKey: "follow",
      title: "New follower",
      body: `${followerName} started following you`,
      data: { nav: "self" },
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

exports.onListingStatusChange = functions
  .region("asia-southeast1")
  .firestore
  .document("listings/{listingId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return null;

    const sellerId = after.sellerId;
    if (!sellerId) return null;
    const itemName = after.name || after.title || "your listing";

    if (before.status === "pending" && after.status === "active") {
      await notifyUser(sellerId, {
        storeType: "sold",
        styleKey: "verified",
        title: "Listing approved",
        body: `"${itemName}" is now live on the marketplace.`,
        data: { nav: "listing", listingId: context.params.listingId },
      });
    }

    if (after.status === "rejected") {
      await notifyUser(sellerId, {
        storeType: "system",
        styleKey: "rejected",
        title: "Listing not approved",
        body: `"${itemName}" was not approved. Tap to edit and re-submit.`,
        data: { nav: "listing", listingId: context.params.listingId, edit: "1" },
      });
    }
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

exports.onReportResolved = functions
  .region("asia-southeast1")
  .firestore
  .document("reports/{reportId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return null;
    if (after.status !== "resolved" && after.status !== "dismissed") return null;
    if (!after.reporterId) return null;

    const targetName = after.kind === "listing"
      ? (after.listingName || "a listing")
      : (after.reportedUserName || "a user");

    const body = after.status === "resolved"
      ? `Your report about ${targetName} was reviewed and action was taken. Thank you.`
      : `Your report about ${targetName} was reviewed. No action was needed.`;

    await notifyUser(after.reporterId, {
      storeType: "system",
      styleKey: "report",
      title: "Report reviewed",
      body,
      data: { nav: "self" },
    });
    return null;
  });
