# SLSU-GumaCart

The campus marketplace for **Southern Luzon State University – Gumaca**. Students and faculty buy, sell, barter and donate items with each other, chat, and meet up on campus.

Only `@slsu.edu.ph` accounts can use the app (admins are the one exception), and sellers verify their student ID before posting.

## Features

- **Listings:** For Sale, Looking For, Barter, Donate; any number of photos, quantity, condition, campus meet-up spot. New and edited listings are approved by an admin. Listings expire after 30 days and can be renewed.
- **Browse:** Home (featured, from your course, latest), categories, search with sort and filters, "Notify me" search alerts, saved items ❤️ with price-drop alerts, similar items.
- **Chat:** product cards, photos and videos (any number at once), voice messages, quick replies, reactions, replies, read receipts, typing and "Active now", mark an item sold right from the chat.
- **Selling:** reserve an item for one buyer, mark sold (or "sold one" for stock), ratings from buyers who bought from you, "Usually replies within…", stats (views, saves, interested), drafts, share as image.
- **Safety:** SLSU-only accounts, student ID verification to sell / barter / donate, report listings, users and chat messages, block users, bans with appeals, admin panel with insights and feedback.
- **App:** push notifications with per-type settings, light and dark mode, an interactive tour (Settings → App Tour), offline cache.

## Tech stack

| Part | Uses |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19, React Navigation 7 |
| Backend | Firebase Auth, Firestore, Storage, Cloud Functions (Node 22, region `asia-southeast1`) |
| Builds | EAS Build (`preview` = APK for testing, `production` = Play Store bundle) |
| Push | Expo push service via FCM (`google-services.json`) |

## Project layout

```
App.js                 Root: fonts, theme, auth, error boundary, alerts
navigation/            Tabs + stacks, deep links, notification taps
screens/               One file per screen
components/            Shared UI: Sheet (pop-up forms), AppAlert, ProductCard,
                       CoachMark (tours), KeyboardScrollView, ZoomableImage, ...
context/               AuthContext (user, ban + SLSU checks), ThemeContext
constants/             theme (colors, fonts), listings, school (domain, courses,
                       meet-up spots), privacy policy text
utils/                 Firestore helpers and shared stores (listings, wishlist,
                       search alerts, chat, uploads, notifications)
functions/             Cloud Functions (notifications, moderation, reservations,
                       listing expiry, account cleanup, shared-link pages)
firestore.rules        Firestore security rules
firestore.indexes.json Composite / collection-group indexes
storage.rules          Storage security rules
scripts/               export-privacy.js (writes PRIVACY.md), make-splash.sh,
                       make-avatars.sh, remove-phone-numbers.js,
                       check-push.js (read-only: who gets direct pushes)
patches/               expo-notifications: notification picture from push data
                       (applied by patch-package on npm install)
hosting/               Firebase Hosting: icon, letter avatars, App Links file
```

## Running it

```bash
npm install
npx expo start --go -c            # then scan the QR code with Expo Go
```

If the phone can't connect:
- Put the phone on the same Wi-Fi as the computer.
- Allow the port through the firewall: `sudo ufw allow from 192.168.0.0/16 to any port 8081 proto tcp`
- Or use a tunnel: `npx expo start --go -c --tunnel`

Expo Go can't show push notifications or the real app icon and splash. Use an APK for those.

## Building an APK

```bash
npx eas-cli build --platform android --profile preview
```

The download link appears when the build finishes (expo.dev → GumaCart → Builds). Version numbers are managed by EAS (`appVersionSource: remote`).

### Building on this computer (free, no monthly limit)

EAS's free plan has a monthly build limit. A local build makes the same APK, signed with the same key (fetched from your Expo account):

```bash
env JAVA_HOME=/usr/lib/jvm/java-17-openjdk ANDROID_HOME=$HOME/Android/Sdk \
  npx eas-cli build --platform android --profile preview --local --output ~/gumacart-apk/gumacart.apk
```

It needs Java 17 (`jdk17-openjdk`) and the Android SDK command-line tools in `~/Android/Sdk`. The first build takes ~25 minutes.

## Push notifications

- The server (`notifyUser` in `functions/index.js`) sends **directly through Firebase** to phones that paired their Firebase token with their Expo token (`fcmFor` on the user doc), and through Expo's push service to the rest (older APKs). Each phone gets one notification.
- Direct pushes are data-only, so the app draws them: one card per chat that updates (`tag`), the sender's round picture, Messenger-style conversation layout for chats. While the app is open, the chat on screen doesn't pop up (`setActiveConversation`).
- These come from a patch to **expo-notifications 57.0.24** (`patches/`, applied on `npm install`), and `package.json → expo.autolinking.android.buildFromSource` makes the build compile it (the package otherwise ships a prebuilt copy, which ignores the patch).
- **If expo-notifications is ever upgraded, the patch has to be redone** for the new version; otherwise the install fails or the notification fixes silently disappear.
- `scripts/check-push.js` (read-only) shows which accounts have paired phones.

## Deploying the backend

```bash
npx firebase-tools deploy --only functions,firestore:rules,firestore:indexes,storage,hosting
```

- Cloud Functions need the Firebase **Blaze** plan. The scheduled ones (reservations, listing expiry) use Cloud Scheduler.
- New indexes take a few minutes to build.
- Shared listing links (`https://gumacartfinal.web.app/listing/<id>`) are pages built by the `listingPage` function (`functions/listingPage.js`), with the item's photo, name and price for link previews. `hosting/` holds the icon and letter avatars. `hosting/.well-known/assetlinks.json` lets Android open those links straight in the app; it holds the APK signing fingerprint, so add the Play Store signing fingerprint there when publishing.
- If the deploy asks to delete indexes that aren't in `firestore.indexes.json`, answer **N**.

## Admin

Admins have `role: "admin"` on their `users/{uid}` document; set it in the Firebase console. Admins review student IDs, faculty requests, new listings, reports and appeals in **Profile → Admin Panel**.

## Conventions

- **Colors and fonts** come from `useTheme()` (`constants/theme.js`), never hard-coded, so dark mode works.
- **Pop-up forms** use `components/Sheet.js`.
- **Alerts and confirmations** use `components/AppAlert.js` (`Alert.alert` with the app's styling).
- **Long forms** use `KeyboardScrollView`, so the focused field stays above the keyboard.
- **SLSU domain:** keep `constants/school.js` and `isSlsuEmail()` in `firestore.rules` in sync.
- **Privacy policy:** after editing `constants/privacy.js`, run `npm run privacy` to regenerate `PRIVACY.md`.
- **Splash:** `assets/splash-icon.png` (Android's system splash) and `assets/splash.jpg` (the full splash) come from `scripts/make-splash.sh`; edit and rerun it to change them.
