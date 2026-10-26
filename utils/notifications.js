import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Detect Expo Go — push was removed from Expo Go in SDK 53.
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    Notifications = null;
  }
}

// The push tokens registered for the signed-in user on this phone, so they
// can be removed from their account when they log out.
let currentToken = null;
let currentFcmToken = null;

// Set debug=true to see alerts explaining exactly where registration stops.
const DEBUG = false;

function debugAlert(msg) {
  if (DEBUG) {
    try { Alert.alert('Push debug', String(msg)); } catch (e) {}
  }
}

export async function registerForPushNotifications(userId) {
  if (!userId) { debugAlert('No userId'); return null; }
  if (isExpoGo) { debugAlert('Running in Expo Go — push not supported here.'); return null; }
  if (!Notifications) { debugAlert('expo-notifications not loaded'); return null; }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E6B3E',
      });
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2980b9',
      });
      await Notifications.setNotificationChannelAsync('social', {
        name: 'Reviews',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200],
        lightColor: '#2E6B3E',
      });
      await Notifications.setNotificationChannelAsync('account', {
        name: 'Account & Verification',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200],
        lightColor: '#2E6B3E',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      debugAlert('Permission NOT granted: ' + finalStatus);
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      Constants?.manifest?.extra?.eas?.projectId ??
      Constants?.manifest2?.extra?.eas?.projectId;

    if (!projectId) {
      debugAlert('No EAS projectId found in config. Push token needs it.');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    currentToken = token;

    debugAlert('Got token: ' + token);

    await setDoc(
      doc(db, 'users', userId),
      { pushTokens: arrayUnion(token) },
      { merge: true }
    );

    // The phone's own Firebase token. The server sends through Firebase
    // directly when it has one, so a new message replaces its chat's
    // notification and shows the sender's picture (Expo's service drops both).
    if (Platform.OS === 'android') {
      try {
        const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();
        if (fcmToken) {
          currentFcmToken = fcmToken;
          await setDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(fcmToken) }, { merge: true });
        }
      } catch (e) {
        debugAlert('FCM token error: ' + (e?.message || e));
      }
    }

    debugAlert('Token saved to Firestore!');
    return token;
  } catch (e) {
    debugAlert('ERROR: ' + (e?.message || e));
    return null;
  }
}

// Stop sending this account's notifications to this phone. Must run while
// still signed in (the user doc is only writable by its owner).
export async function unregisterPushToken(userId) {
  if (!userId || (!currentToken && !currentFcmToken)) return;
  const update = {};
  if (currentToken) update.pushTokens = arrayRemove(currentToken);
  if (currentFcmToken) update.fcmTokens = arrayRemove(currentFcmToken);
  try {
    await updateDoc(doc(db, 'users', userId), update);
  } catch (e) {
    // Not fatal: the server also prunes tokens reported as dead.
  }
  currentToken = null;
  currentFcmToken = null;
}

export function addNotificationResponseListener(handler) {
  if (isExpoGo || !Notifications) return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      handler(data);
    });
    return () => sub.remove();
  } catch (e) {
    return () => {};
  }
}

// Clear a chat's notification from the phone's tray (the server tags each
// chat's notification "chat_<conversationId>"), e.g. when the chat is opened.
export function dismissChatNotification(conversationId) {
  if (isExpoGo || !Notifications || !conversationId) return;
  Notifications.dismissNotificationAsync(`chat_${conversationId}`).catch(() => {});
}
