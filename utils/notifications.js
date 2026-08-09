import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Detect Expo Go — push was removed from Expo Go in SDK 53.
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications = null;
let Device = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');

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
    Device = null;
  }
}

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
        name: 'Followers & Reviews',
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

    debugAlert('Got token: ' + token);

    await setDoc(
      doc(db, 'users', userId),
      { pushTokens: arrayUnion(token) },
      { merge: true }
    );

    debugAlert('Token saved to Firestore!');
    return token;
  } catch (e) {
    debugAlert('ERROR: ' + (e?.message || e));
    return null;
  }
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
