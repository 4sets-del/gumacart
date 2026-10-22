// The v1 API keeps the existing deployed (1st gen) functions as they are.
const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
const db = getFirestore();

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

async function notifyUser(userId, { storeType, styleKey, title, body, data, groupTag, collapseKey }) {
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
  if (!tokens.length) return;

  // Settings → Notifications. Muted types are still saved to the in-app list
  // above; only the phone push is skipped.
  const prefs = userData.notifPrefs || {};
  if (prefs.muteAll === true) return;
  if (data?.nav === "listing" && prefs.listings === false) return;
  if (storeType === "message" && prefs.messages === false) return;
  if (storeType === "follow" && prefs.followers === false) return;
  if (storeType === "review" && prefs.reviews === false) return;

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

  const deadTokens = await sendExpoPush(messages);
  if (deadTokens.length) {
    await db.collection("users").doc(userId).update({ pushTokens: FieldValue.arrayRemove(...deadTokens) });
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

    // Seller marked it sold and picked the buyer: invite them to rate.
    if (after.status === "sold" && after.soldTo && after.soldTo !== sellerId) {
      const sellerName = after.sellerName || "the seller";
      await notifyUser(after.soldTo, {
        storeType: "rate_prompt",
        styleKey: "review",
        title: "How was your purchase?",
        body: `You got "${itemName}" from ${sellerName}. Tap to leave a rating.`,
        data: { nav: "profile", profileId: sellerId, profileName: sellerName, rate: "1" },
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

  // Follow links stored on the other side of each relationship.
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

  // Profile document plus its cart, notifications, followers and following.
  await db.recursiveDelete(userRef);

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
