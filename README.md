# SLSU-GumaCart

The campus marketplace for **Southern Luzon State University – Gumaca**. Students and faculty buy, sell, barter and donate items with each other, chat, make offers, and plan safe meet-ups on campus.

Only `@slsu.edu.ph` accounts can use the app (admins are the one exception), and sellers verify their student ID before posting.

## Features

- **Listings:** For Sale, Looking For, Barter, Donate; up to 6 photos, quantity, condition, campus meet-up spot. New and edited listings are approved by an admin. Listings expire after 30 days and can be renewed.
- **Browse:** Home (featured and latest), categories, search with sort and filters, "Notify me" search alerts, saved items ❤️.
- **Chat:** product cards, photos and videos (up to 10 at once), reactions, replies, read receipts, **Make an Offer**, **Plan a Meet-up** (with a reminder an hour before).
- **Selling:** cart checkout through chat, reserve an item for one buyer, mark sold (or "sold one" for stock), ratings and reviews, followers.
- **Safety:** SLSU-only accounts, student ID verification, reports, bans with appeals, admin panel.
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
                       search alerts, cart, chat, uploads, notifications)
functions/index.js     Cloud Functions (notifications, moderation, reminders,
                       listing expiry, account cleanup)
firestore.rules        Firestore security rules
firestore.indexes.json Composite / collection-group indexes
storage.rules          Storage security rules
scripts/               export-privacy.js (writes PRIVACY.md)
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

## Deploying the backend

```bash
npx firebase-tools deploy --only functions,firestore:rules,firestore:indexes,storage
```

- Cloud Functions need the Firebase **Blaze** plan. The scheduled ones (reservations, meet-up reminders, listing expiry) use Cloud Scheduler.
- New indexes take a few minutes to build.
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
