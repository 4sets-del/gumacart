# SLSU-GumaCart — APK Build & Push Notifications Setup

Follow these in order. Steps 1–4 are one-time setup. Step 5 builds the APK.

---

## 0. Copy the new/updated files into your project

Overwrite/add these from the outputs:

- `App.js`
- `context/AuthContext.js`
- `navigation/AppNavigator.js`
- `utils/notifications.js`               (NEW folder + file)
- `functions/index.js`                   (NEW folder)
- `functions/package.json`               (NEW)
- `screens/NotificationsScreen.js`
- `screens/HomeScreen.js`
- `screens/ProfileScreen.js`
- `screens/FollowingScreen.js`           (NEW)
- ...plus every other screen we polished this session
- `app.json`, `eas.json`, `firestore.rules`  (project root)

Also DELETE `screens/FilterScreen.js` (no longer used).

---

## 1. Install packages

Run in your project root:

    npx expo install expo-notifications expo-device expo-constants
    npx expo install react-native-svg react-native-safe-area-context

(You already have most others. This makes sure notifications + safe area + svg are present.)

---

## 2. Fill in your real values

**firebaseConfig.js** — make sure it has your REAL gumacartfinal keys
(apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
It currently has "YOUR_PROJECT" placeholders.

**app.json**
- `android.package` / `ios.bundleIdentifier`: pick your own reverse-domain id
  (e.g. com.yourname.gumacart). Keep them identical across builds.
- `extra.eas.projectId`: filled automatically when you run `eas build:configure`
  (step 5), OR paste it manually after `eas init`.

**Assets** (put in /assets):
- icon.png            1024 x 1024
- adaptive-icon.png   1024 x 1024 (Android)
- splash.png          ~1284 x 2778 (or any tall image; green bg is set)

---

## 3. Publish Firestore rules

Firebase Console -> Firestore Database -> Rules -> paste contents of
firestore.rules -> Publish.

(Adds: followers, following, notifications subcollections.)

---

## 4. Deploy Cloud Functions (needs Blaze plan)

    npm install -g firebase-tools
    firebase login
    firebase init functions
      -> choose your gumacartfinal project
      -> JavaScript
      -> when asked to overwrite index.js / package.json: say NO,
         then copy our functions/index.js and functions/package.json in
      -> install dependencies: Yes

    cd functions
    npm install
    firebase deploy --only functions

During deploy Firebase will ask you to upgrade to the Blaze plan
(pay-as-you-go). A campus app stays within the free tier; you just
need a card on file.

This deploys two functions:
- onNewListing  -> pushes to everyone who follows the seller
- onNewMessage  -> pushes to the message recipient
Both also save an in-app notification doc so the bell screen fills up.

---

## 5. Build the APK

    npm install -g eas-cli
    eas login
    eas build:configure       # fills extra.eas.projectId in app.json

Then build an installable APK:

    eas build --platform android --profile preview

Wait ~10–20 min. Expo gives a download link. Install the APK on your phone.

To test push notifications you MUST use this APK (or a dev build) —
push does NOT work in Expo Go on Android anymore.

---

## What now works

- Status bar no longer overlaps headers (safe-area fix)
- Push notification: a seller you follow posts a listing
- Push notification: someone sends you a message
- In-app Notifications screen + bell badge fill from Firestore
- Follow / followers / following
- Colored listing type badges, cart flow, splash screen, etc.

---

## Quick test after install

1. Sign in on two phones (or phone + emulator) as two different users.
2. User A follows User B (on B's seller profile).
3. User B posts a listing -> User A should get a push + see it in the bell.
4. User A messages User B -> User B gets a push + bell entry.

If pushes don't arrive:
- Confirm both users granted notification permission (first launch prompt).
- Confirm the user doc has a `pushTokens` array in Firestore.
- Check Functions logs: `firebase functions:log`
