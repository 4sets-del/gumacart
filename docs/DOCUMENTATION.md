# SLSU-GumaCart — Project Documentation

The campus marketplace for **Southern Luzon State University – Gumaca**. Students and faculty buy, sell, barter, donate and ask for items, chat with each other, and meet up on campus.

This document explains **what the app does, what each feature is for, how it works, and how it is built**, plus the technologies, the backend, how the project developed, and how to build and maintain it.

> Quick reference for day-to-day commands lives in [`README.md`](../README.md). This document is the long version.

---

## Contents

1. [Purpose and goals](#1-purpose-and-goals)
2. [Technologies](#2-technologies)
3. [Architecture](#3-architecture)
4. [Project structure](#4-project-structure)
5. [Features](#5-features)
   - 5.1 [Accounts and access (SLSU-only)](#51-accounts-and-access-slsu-only)
   - 5.2 [Student ID verification and faculty status](#52-student-id-verification-and-faculty-status)
   - 5.3 [Listings](#53-listings)
   - 5.4 [Browsing: Home, Categories, Search](#54-browsing-home-categories-search)
   - 5.5 [Saved items, search alerts and price drops](#55-saved-items-search-alerts-and-price-drops)
   - 5.6 [Chat](#56-chat)
   - 5.7 [Selling tools: reserve, mark sold, stock](#57-selling-tools-reserve-mark-sold-stock)
   - 5.8 [Ratings and reviews (per purchase)](#58-ratings-and-reviews-per-purchase)
   - 5.9 [Push notifications](#59-push-notifications)
   - 5.10 [Sharing listings](#510-sharing-listings)
   - 5.11 [Safety: reports, blocking, bans and appeals](#511-safety-reports-blocking-bans-and-appeals)
   - 5.12 [Admin panel](#512-admin-panel)
   - 5.13 [Profiles, settings and the rest of the app](#513-profiles-settings-and-the-rest-of-the-app)
6. [Backend](#6-backend)
   - 6.1 [Firestore data model](#61-firestore-data-model)
   - 6.2 [Security rules](#62-security-rules)
   - 6.3 [Cloud Storage](#63-cloud-storage)
   - 6.4 [Cloud Functions](#64-cloud-functions)
   - 6.5 [Firebase Hosting](#65-firebase-hosting)
7. [How the project developed](#7-how-the-project-developed)
8. [Building, running and deploying](#8-building-running-and-deploying)
9. [Scripts](#9-scripts)
10. [Maintenance notes and known limits](#10-maintenance-notes-and-known-limits)

---

## 1. Purpose and goals

**The problem.** Students at SLSU Gumaca buy and sell things to each other all the time (books, uniforms, gadgets, food, services), but they do it through general apps that are open to everyone. That means dealing with strangers, scams, and apps that weren't designed for a school.

**The goal.** A marketplace that is:

- **Campus-only** — only `@slsu.edu.ph` accounts can use it, and sellers verify their student ID.
- **Safe** — every new listing is reviewed by an admin; users can report listings, people and chat messages; repeat offenders can be suspended.
- **Simple** — features are chosen for students and faculty, not copied from big marketplaces. Things that weren't used (offers, scheduled meet-ups, follows, a cart) were removed during development.
- **Familiar** — it behaves like the apps students already use: Messenger-style chat and notifications, Shopee-style listing videos, Facebook-Marketplace-style listing cards.

**Who uses it.** Students and faculty of SLSU Gumaca, plus admins who moderate.

---

## 2. Technologies

### App (Android, built with React Native)

| Technology | Version | What it's used for |
|---|---|---|
| **React Native** | 0.86.3 | Building the Android app in JavaScript |
| **React** | 19.2.3 | UI components and state |
| **Expo SDK** | 57 | Tooling, native modules, builds (the app is an Expo project) |
| **React Navigation** | 7 (stack + bottom tabs) | Screens, tabs, deep links |
| **Firebase JS SDK** | 12.17.0 | Login (Auth), database (Firestore), file storage (Storage) |
| **expo-notifications** | 57.0.24 (patched, built from source) | Push notifications; see §5.9 |
| **expo-image-picker** | 57 | Picking photos/videos, camera |
| **expo-image-manipulator** | 57 | Compressing photos before upload |
| **expo-image** | 57 | Fast cached images |
| **expo-video** | 57 | Listing and chat videos |
| **expo-audio** | 57 | Voice messages |
| **expo-linear-gradient** | 57 | Gradients (headers, banners, buttons) |
| **expo-sharing** + **react-native-view-shot** | 57 / 5.1 | "Share as image" listing cards |
| **expo-linking** | 57 | Shared links that open the app |
| **expo-splash-screen**, **expo-system-ui** | 57 | Splash screen, system bars |
| **expo-haptics** | 57 | Small vibrations on taps |
| **react-native-gesture-handler** | 2.32 | Pinch-to-zoom photos, swipe actions |
| **@react-native-async-storage/async-storage** | 2.2 | Login persistence, offline listing cache, drafts |
| **@react-native-community/netinfo** | 12 | "You're offline" banner |
| **@sentry/react-native** | 7.11 | Opt-in crash reports |
| **Poppins** (`@expo-google-fonts/poppins`) | — | Headings, titles, prices |
| **Ionicons** (`@expo/vector-icons`) | — | Icons |
| **patch-package** | 8 | Applies our fix to expo-notifications on every install |

### Backend (Firebase)

| Service | What it's used for |
|---|---|
| **Firebase Authentication** | Email + password accounts, email verification |
| **Cloud Firestore** | All data: users, listings, chats, reviews, notifications, reports… |
| **Cloud Storage** | Photos, videos, voice messages, ID photos |
| **Cloud Functions** (Node 22, `firebase-functions` 7, `firebase-admin` 14, region `asia-southeast1`) | Notifications, moderation, expiry, cleanup, shared-link pages |
| **Cloud Scheduler** | Runs the timed functions (reservations, listing expiry) |
| **Firebase Cloud Messaging (FCM)** | Delivers push notifications to Android phones |
| **Firebase Hosting** (`gumacartfinal.web.app`) | Shared-link pages, App Links file, letter avatars |

### Tooling

| Tool | What it's used for |
|---|---|
| **EAS Build** (Expo Application Services) | Building APKs (online, or `--local` on this computer) |
| **Expo push service** | Notifications for phones on older APKs |
| **ESLint** (`eslint-config-expo`) | Code checks (`npm run lint`) |
| **expo-doctor** | Dependency health checks |
| **ImageMagick** | Generating the splash screen and letter avatars |
| **Java 17 + Android SDK** | Local APK builds |

---

## 3. Architecture

```
 ┌──────────────── Android phone ────────────────┐
 │  GumaCart app (React Native / Expo)           │
 │   screens/ ── components/ ── utils/           │
 │        │  Firebase JS SDK                     │
 └────────┼──────────────────────────────────────┘
          │ reads / writes (checked by security rules)
          ▼
 ┌──────────────── Firebase (gumacartfinal) ─────┐
 │  Auth        Firestore        Storage         │
 │                 │ triggers                    │
 │                 ▼                             │
 │          Cloud Functions ──► FCM / Expo push ─┼──► notifications on phones
 │                 │                             │
 │          Hosting: /listing/<id> (listingPage) │◄── shared links from Messenger, etc.
 └───────────────────────────────────────────────┘
```

**How the pieces divide the work:**

- **The app** shows screens and talks to Firebase directly (there is no separate custom server). Most features are "the app writes a document; everyone else reads it live".
- **Security rules** decide who may read or write what (e.g. only SLSU accounts may create listings).
- **Cloud Functions** do anything that must not depend on a user's phone: sending notifications, recomputing ratings, expiring listings, deleting files, deleting accounts, building shared-link pages.
- **Live updates.** Most lists (listings, chats, notifications) use Firestore listeners, so changes appear without refreshing.

---

## 4. Project structure

```
App.js                  Root: fonts, theme, auth, error boundary, alerts
navigation/             AppNavigator.js — tabs, stacks, deep links, notification taps
screens/                One file per screen (25 screens)
components/             Shared UI (cards, sheets, alerts, video player, zoom, tour…)
context/                AuthContext (user, profile, SLSU/ban checks), ThemeContext
constants/              theme (colors/fonts), listings (categories, prices),
                        school (SLSU domain, courses, ages, posting rules), privacy text
utils/                  Firestore helpers and shared stores (listings, wishlist, chat,
                        uploads, notifications, presence, reports, blocking…)
functions/              Cloud Functions (index.js) + listing page (listingPage.js)
hosting/                Firebase Hosting: icon, letter avatars, App Links file
firestore.rules         Firestore security rules
firestore.indexes.json  Firestore indexes
storage.rules           Storage security rules
patches/                Our fix to expo-notifications (applied on npm install)
scripts/                Splash/avatar generators, privacy export, admin scripts
assets/                 Icon, splash, campus photos, team photos
docs/                   This documentation
```

**Screens:** Splash, Welcome, Login, Signup, EmailVerification, SchoolEmailRequired, Banned, Home, Categories, Search, ProductDetail, CreateListing, MyListings, Saved, Messages, Chat, Notifications, Profile, SellerProfile, Settings, Verification, AdminPanel, About, Privacy, Terms.

---

## 5. Features

Each feature below is described as **What it's for → How it works → How it's built**.

### 5.1 Accounts and access (SLSU-only)

**What it's for.** Keeping the marketplace inside the SLSU community, so users deal with fellow students and faculty, not strangers.

**How it works.**

1. Sign Up asks for name, address, age (12–100), role (student/faculty), course and year level, email and password.
2. The email must end exactly with **`@slsu.edu.ph`** (capitals and surrounding spaces are ignored). While typing, the hint under the field turns red for a wrong email and a green ✓ appears for a right one; tapping Sign Up with a wrong email shows "SLSU email required".
3. Firebase sends a **verification link** to that inbox; the app stays on the "Verify your email" screen until it's clicked. This proves the person really owns that SLSU mailbox — typing an address isn't enough.
4. Accounts that aren't SLSU (e.g. created before the rule) see only the **"SLSU email required"** screen with a logout button. Since 2026-10-29 this applies to **everyone, admins included**.

**How it's built.**

- The domain is declared once for the app: `SCHOOL_DOMAIN = 'slsu.edu.ph'` and `isSchoolEmail()` in `constants/school.js`.
- `screens/SignupScreen.js` uses it for the hint, the ✓ and the alert.
- `context/AuthContext.js` computes `schoolAccess`; `navigation/AppNavigator.js` shows `SchoolEmailRequiredScreen` when it's false.
- **Server check:** `isSlsuEmail()` in `firestore.rules` requires an SLSU email (taken from Firebase's sign-in token, so it can't be faked) to create a user profile or a listing. This is what stops anyone bypassing the app.
- `scripts/delete-non-slsu.js` removes existing non-SLSU accounts (see §9).
- Login is persisted on the phone with AsyncStorage, so users stay signed in.

### 5.2 Student ID verification and faculty status

**What it's for.** A second layer of trust for people who **hand items to others**. Anyone with an SLSU email can post a "Looking For" request, but selling, bartering and donating require a verified student ID.

**How it works.**

1. In **Verification**, the student enters their student ID number and uploads a photo of their ID (camera or gallery).
2. An admin reviews it in the Admin Panel and approves or rejects it (with a reason).
3. The student gets a notification ("✅ You're verified!" or "⚠️ Verification not approved"), and the For Sale / Barter / Donate options unlock in the post picker (locked types show a 🔒 and "Needs a verified student ID").
4. Faculty choose "faculty" at sign-up; they're created as students with a **faculty request** that an admin approves or declines.

**How it's built.** `screens/VerificationScreen.js`, `components/PostTypeSheet.js`, `canPostType()` / `isVerifiedPoster()` in `constants/school.js` (admins are exempt from ID verification), admin actions in `screens/AdminPanelScreen.js`, notifications from `onUserDocUpdate` in `functions/index.js`. ID photos are stored under `verifications/`.

### 5.3 Listings

**What it's for.** The core of the marketplace: posting items, requests and services.

**Listing types.** **For Sale**, **Looking For** (a request, with an optional budget), **Barter**, **Donate**.
**Categories.** Food & Drinks, Clothes & Fashion, Academic, Electronics, Personal Belongings, Crafts & Handmade, Services, Others.

#### Creating and editing (`screens/CreateListingScreen.js`)

- **Photos and videos, no limit on how many.** Add from the camera ("Take Photo", "Record Video") or the gallery (photos and videos together). Videos come first in the row; the **first photo is the Cover** — the thumbnail used on cards, in search, share cards and link previews. At least one photo is required.
- **Gallery shows all albums.** Android's newer photo picker only lists a few albums, so photos saved by Messenger or Facebook were hard to find. `utils/pickFromGallery.js` opens the phone's full picker instead (every folder, plus Gallery/Google Photos).
- **Fields:** title (80 chars), description (500), price or budget (digits only, up to **₱1,000,000**, `MAX_PRICE` in `constants/listings.js`), quantity (1–99), category, condition (optional for food and donations), meet-up spot (Library, Main Gate, Admin Office, Dormitory, or Other).
- **No phone numbers.** Contact happens in chat only (older listings had their numbers removed by `scripts/remove-phone-numbers.js`).
- **Live preview** of the card as it will appear, inline field errors, and **drafts** saved automatically on the phone.
- **Uploading.** Photos are compressed (max 1280 px, JPEG) and uploaded **three at a time** (`mapLimit` in `utils/upload.js`) so many photos don't run a phone out of memory; videos upload one at a time, uncompressed; a progress counter shows "3 / 12".

#### Approval

New listings are created with status **pending** and appear only after an admin approves them. Edits go back to pending — except **lowering only the price**, which stays live and triggers price-drop alerts (§5.5). Rejected listings notify the seller, who can edit and resubmit.

#### Listing page (`screens/ProductDetailScreen.js`)

- **Media swiper:** videos first, then photos. Videos **play muted on a loop** in place (like Shopee), with a 🔇 button to turn sound on; tapping opens full screen. Photos open in a zoomable full-screen viewer (`components/ZoomableImage.js`). Thumbnails under the swiper (video thumbnails are live, muted previews). More than 8 items shows a "3 / 25" counter instead of dots.
- Details, seller card (rating, "Usually replies within…"), similar items, share, save (❤️), report.
- **Buyer bar:** Save + "Message Seller" (opens chat with a product card).
- **Seller-only stats:** views, saves, and people interested — visible only to the owner.
- The page follows the listing live and shows if it was removed, sold or expired.

#### Age, expiry and renewal

- Each card shows how long ago the listing went live ("Just now", "5m", "3h", "2d", then a date). The age counts from **when it went live** (`listedAt`: first approval or last renewal), not from when it was drafted — a listing approved two days late still shows as new. Editing keeps the original age.
- Listings expire **30 days** after going live (`expireListings`, daily at 09:00). The seller is warned 3 days before, and can **renew** an expired listing with one tap (`utils/renewListing.js`), which puts it back on top.

#### Deleting

Deleting a listing (by the seller, an admin, or account deletion) also deletes its photos and videos from storage — done by the server (`onListingDeleted`), so it always happens. Photos removed while editing are deleted too.

### 5.4 Browsing: Home, Categories, Search

**What it's for.** Finding things quickly.

**Home (`screens/HomeScreen.js`):**
- Greeting, search bar, shortcuts to Saved and Notifications (with unread badges).
- Banner carousel and category shortcuts.
- **Featured Listings** — the 8 most popular active listings (seller rating + views).
- **From BIT-CPT students** — listings from sellers in *your* course. Shown only once there are **at least 6**, so it never looks empty; **See All** opens Search filtered to your course.
- **All Listings · newest first** — every active listing, with type chips (All / For Sale / Looking For / Barter / Donate), as a virtualized grid (only cards near the screen are drawn).

**Categories** — browse by category.

**Search (`screens/SearchScreen.js`):**
- Search by title, description, place or category; recent searches; a **Sellers** tab to find people.
- **Sort:** Most Relevant, Newest First, Price Low→High, Price High→Low, Highest Rated (seller).
- **Filter sheet:** price range, categories, posted within (any time / last 24 hours / this week / this month), listing type, and **seller's course** (BSBA-HRM, BSN, BIT-CPT, BSEd-SS, BSEd-Math).

**How it's built.** Active listings are loaded once into a **shared store** (`utils/useListings.js`): one live Firestore listener, updated incrementally, cached on the phone (AsyncStorage) so Home appears instantly even offline, and filtered for blocked sellers. Seller names, photos, courses and ratings come from a **5-minute shared profile cache** (`utils/userCache.js`) so each profile is downloaded once. Courses are defined in `constants/school.js`; old codes (BSIT-CT and BSIT-CPT, BSBA-HR) are read as the new ones (BIT-CPT, BSBA-HRM).

### 5.5 Saved items, search alerts and price drops

- **Saved items ❤️** (`utils/wishlist.js`, `screens/SavedScreen.js`): save any listing; a small copy is stored so the Saved screen loads fast. Saving also counts toward the seller's "Saves" stat and marks you as interested.
- **Search alerts** ("Notify me", `utils/searchAlerts.js`): save a search; when a matching listing is approved you get "📢 New match for 'laptop'". Matching uses keywords on the server (`onListingStatusChange`), each alert fires once per listing.
- **Price drops:** when a seller lowers a price, everyone who saved it gets "📢 Price drop on a saved item".
- **Interested buyers:** people who message about or save a listing are recorded, and hear when it's reserved, sold, or available again.

### 5.6 Chat

**What it's for.** All buyer–seller contact happens in-app (no phone numbers), which keeps users safe and lets reports include context.

**How it works (`screens/MessagesScreen.js`, `screens/ChatScreen.js`):**

- Inbox with the other person's photo, last message, unread count and "Active now".
- **Product cards**: "Message Seller" starts the chat with the listing attached.
- **Photos and videos** (any number at once, sent one by one in order), **voice messages** (`components/VoiceMessage.js`), **quick replies** (different sets for buyers and sellers).
- **Reactions, replies, edit** (within 15 minutes, marked "edited") and delete.
- **Seen / Sent** under your latest message, **typing…** indicator, **Active now** (presence heartbeat every 2 minutes, "active" = seen in the last 5).
- **Mark as sold** right from the chat (seller), which records the sale and asks the buyer to rate.
- **Block** and **report a message** from the ⋮ menu.
- Deleting a conversation removes it only for you.

**How it's built.** `conversations/{id}` holds participants, last message, unread counts, typing and read times; messages are a sub-collection. Only the latest messages load ("Load earlier messages" for more). Media goes to Storage under `chats/`. Presence is `utils/presence.js`; reply-time stats are computed on the server.

### 5.7 Selling tools: reserve, mark sold, stock

- **Reserve for a buyer** — marks the item reserved for one person; others see "Reserved", the buyer is notified. After **2 days** the seller is reminded; after **4 days** it's released automatically (`checkReservations`, every 6 hours).
- **Mark sold** — to a specific buyer (from the listing or chat). This writes a **sale record** (`deals/{id}`) on the server and sends the buyer "⭐ How was your purchase?".
- **Stock** — a quantity above 1 sells "one at a time": each sale reduces the stock and creates its own sale record.
- **My Listings** — your listings by status (pending, active, sold, expired, rejected).

### 5.8 Ratings and reviews (per purchase)

**What it's for.** Trustworthy ratings: only real buyers can rate, and each purchase is rated once.

**How it works.**

- When a seller marks an item sold to you, you can rate **that purchase**: stars, an optional comment, and **optional photos (no limit)** of what you received. The rating notification opens the form for that exact item.
- Buying a second item from the same seller lets you rate again — each review shows **"Bought: Cowboy Hat"** with the item's picture.
- Reviews can be edited or deleted by their author. Review photos open full screen.
- If you haven't bought from someone, their profile says "Buyers can rate [name] after buying from them" instead of offering a review button.

**How it's built.** A review's document ID **is the sale record's ID** (`reviews/{dealId}`), which makes "one review per purchase" automatic. `purchasesFrom()` in `utils/deals.js` finds your purchases and which are unrated (older reviews without an item count as covering the earliest purchase). The seller's average and count are recomputed on the server (`onReviewWrite`). Review photos live in `reviews/<reviewer>/<review>/` and are deleted with the review.

### 5.9 Push notifications

**What it's for.** Telling users about messages, sales, approvals and alerts even when the app is closed — and making chat notifications feel like Messenger.

#### What users see

| Type | Example | Look |
|---|---|---|
| 💬 Chat | **CHOPLOKIN** — "Available pa po?" | Android **conversation** layout: sender's **round picture on the left**, messages under their name, in the "Conversations" section. A new message from the same chat **updates the same card** ("2 new messages"). |
| ⭐ Reviews | "New review ★★★★★ — Omar for 'Cowboy Hat'" | Reviewer's round picture |
| ✅ / ⚠️ Approvals | "You're verified!", "Listing approved", "Listing not approved" | App icon, green / red |
| 📢 Listings & alerts | "New match for 'laptop'", "Price drop", "Reserved for you", "Expiring in 3 days" | App icon, purple |
| 🚫 📩 🚩 Account | "Account suspended", "Account restored", "Warning about a message" | App icon, red / green / orange |

The small icon's colour depends on the type. People without a profile photo get a **coloured letter circle** (same colours as in the app). Tapping a notification opens the right chat, listing or profile. Users can switch types off in **Settings → Notifications** (or mute all). While you're **in a chat**, its new messages don't pop up; logging out clears the tray.

#### How it works — two delivery routes

1. **Direct route (current APKs).** The server sends through **Firebase Cloud Messaging** directly, as *data-only* messages. The app then draws the notification itself, which is what allows the stacking (`tag` = `chat_<conversationId>`), the round sender picture, and the conversation layout.
2. **Expo route (older APKs).** Phones that haven't paired send through Expo's push service: one card per message, no picture.

Each phone stores its **Expo token** and its **Firebase token** together (`fcmFor[expoToken] = fcmToken` on the user document, written by `utils/notifications.js`). The server (`notifyUser` in `functions/index.js`) sends the direct push to paired phones and the Expo push to the rest — **every phone gets exactly one**. Dead tokens are removed automatically; rejected direct pushes are logged.

#### How it's built — the patch

The stock expo-notifications library can't do the above, so the project **patches it** (`patches/expo-notifications+57.0.24.patch`, applied by patch-package on every `npm install`):

- **`RemoteNotificationContent.kt`** — reads the sender's picture from the push data (`image`), downloads it robustly (logs failures to the phone's log under `GumaCartPush`), and exposes the conversation ID and sender name.
- **`ExpoNotificationBuilder.kt`** — crops the picture into a **circle**, and for chats builds Android's **MessagingStyle** with a `Person` (name + picture) plus a long-lived **conversation shortcut**, which Android requires for the Messenger-style layout.
- **`NotificationsHandler.kt`** — the library normally *drops* data-only pushes while the app is open; the patch passes them to the app's handler instead, which shows them (except for the chat on screen).

Because expo-notifications ships a **pre-compiled copy** that would ignore the patch, `package.json` sets `expo.autolinking.android.buildFromSource: ["expo-notifications"]` so the build compiles the patched source.

Letter avatars are pre-generated PNGs on Hosting (`hosting/avatars/<colour>/<letter>.png`, made by `scripts/make-avatars.sh`).

### 5.10 Sharing listings

**What it's for.** Spreading listings to Messenger and Facebook groups, where students already are.

- **Share as image** — a designed card (photo, price, GumaCart branding) rendered off-screen and shared as a picture (`components/ShareCard.js`, react-native-view-shot, expo-sharing).
- **Share link** — `https://gumacartfinal.web.app/listing/<id>`. Messenger shows a **preview with the item's photo, name and price**. Tapping it on Android **opens the app straight to the listing** (Android App Links, verified by `hosting/.well-known/assetlinks.json` with the APK's signing fingerprint). If the app doesn't open directly, the web page offers an "Open in GumaCart" button, or says the app isn't installed.
- Only approved (active or sold) listings show details publicly; pending or rejected ones show a plain page. Seller names and emails are never shown.

**How it's built.** The page is generated by the `listingPage` Cloud Function (`functions/listingPage.js`), which Hosting routes `/listing/**` to (`firebase.json`), cached for up to 10 minutes. The app accepts both `https://gumacartfinal.web.app/listing/<id>` and `gumacart://listing/<id>` (`LINKING` in `navigation/AppNavigator.js`).

### 5.11 Safety: reports, blocking, bans and appeals

- **Report a listing or a user** (`components/ReportSheet.js`) with a reason and optional proof photo; reporters confirm it's a real problem.
- **Report a chat message** (`utils/reportMessage.js`): the report includes the message and **up to 10 messages before and after** (from both people) so admins can judge context. The reported person isn't told who reported them.
- **Admin outcomes:** dismiss, **warn** (the user is notified), **delete the message**, or mark a **false report**. The user is notified of the result (`onReportResolved`).
- **Block a user** (`utils/blocking.js`): you stop seeing their listings and messages; they can't message you; no notifications from them.
- **Suspensions:** admins can suspend an account for a period or permanently. Suspended users see the **Banned** screen and can **appeal**; admins accept or decline (`onAppealResolved`). Expired bans clear automatically.
- **Feedback:** Settings → Send Feedback goes to admins (`onFeedbackCreated` notifies them).

### 5.12 Admin panel

`screens/AdminPanelScreen.js` (admins have `role: "admin"` on their user document, set in the Firebase console; admins need an SLSU email too). Six tabs:

- **Verify** — approve/reject student IDs and faculty requests.
- **Listings** — approve or reject pending listings; browse approved ones (cards note videos: "🎥 2 videos (tap to watch)").
- **Reports** — listings, users and chat messages (`components/MessageReportCard.js` shows the message with its context).
- **Appeals** — accept or decline suspension appeals.
- **Users** — search, suspend (for a period or permanently, with a reason), delete (server-side via `adminDeleteUser`).
- **Insights** — counts and activity, plus feedback sent by users (`components/AdminInsights.js`).

### 5.13 Profiles, settings and the rest of the app

- **Profiles** (`ProfileScreen`, `SellerProfileScreen`): photo, name, course and year ("BIT-CPT · 3rd Year"), badges (verified / faculty), rating breakdown, reviews, active and sold listings, reply time.
- **Settings** (`SettingsScreen`): edit profile (name up to 40 chars, age 12–100, course, photo), notification switches, theme (**System / Light / Dark**), app tour, feedback, privacy policy, terms, about, logout, **delete account** (deletes everything — see `onAccountDeleted`).
- **Dark mode** — every screen uses `useTheme()` colours (`constants/theme.js`, `context/ThemeContext.js`).
- **App tour** — an interactive walkthrough of the Home screen (`components/CoachMark.js`), shown once and available in Settings.
- **Offline** — a non-blocking "You're offline" banner; cached listings still show.
- **Splash screen** — a logo circle that expands into the full campus design (`scripts/make-splash.sh`).
- **Pop-ups** — themed alerts (`components/AppAlert.js`) and one sheet design for every form (`components/Sheet.js`); forms keep the focused field above the keyboard (`components/KeyboardScrollView.js`).
- **Crash reporting** — opt-in Sentry reports, and an error screen instead of a crash (`components/ErrorBoundary.js`).
- **Accessibility** — labels on icon-only buttons.
- **Privacy policy** — in-app (`constants/privacy.js`) and as `PRIVACY.md` (`npm run privacy`); contact `slsugumacart@gmail.com`.
- **About** — the app's story, the team, and the SLSU Gumaca campus banner.

---

## 6. Backend

### 6.1 Firestore data model

| Collection | What's in it |
|---|---|
| `users/{uid}` | Profile: name, email, photo, role (student / faculty / admin / banned), course, year, age, address, verification status, ban info, rating (`avgRating`, `totalReviews`), push tokens (`pushTokens`, `fcmFor`), notification settings |
| `users/{uid}/notifications` | In-app notification list (also stacks per chat via `collapseKey`) |
| `users/{uid}/savedSearches` | Search alerts (keywords) |
| `users/{uid}/blocked` | People this user blocked |
| `listings/{id}` | Type, name, description, price, quantity, category, condition, location, `images`, `videos`, seller, `status` (pending / active / sold / rejected / expired), `listedAt`, reservation, `viewCount`, `saveCount`, `keywords` |
| `listings/{id}/interested` | Who's interested (for reserve/sold notices) |
| `conversations/{id}` | Participants, last message, unread counts, typing, read times |
| `conversations/{id}/messages` | Text, image, video, audio, listing card; reactions, replies, edits |
| `deals/{id}` | Sale records (server-written): buyer, seller, item, price |
| `reviews/{dealId}` | Rating, comment, photos, item bought, reviewer, seller |
| `wishlists/{uid}/items` | Saved items |
| `reports`, `appeals`, `feedback` | Moderation |
| `presence/{uid}`, `replyStats/{uid}` | "Active now", "Usually replies within…" |

Indexes are in `firestore.indexes.json`, including collection-group indexes for saved searches and saved items.

### 6.2 Security rules

`firestore.rules` and `storage.rules` enforce, among others:

- Only signed-in users read data; only **SLSU accounts** create profiles and listings; banned users can't create listings.
- Users edit only their own profile; listing owners or admins edit/delete listings.
- Anyone signed in may only **+1** a listing's view counter and **±1** its save counter.
- Sale records are written only by the server; presence only by its owner.
- Storage: profile photos and review photos are writable only by their owner.

> **Known gap (decided 2026-10-21):** broader tightening of the rules (e.g. who may create reviews, self-verification) was deliberately postponed, since the user base is a single campus. **Revisit before any public / Play Store release.**

### 6.3 Cloud Storage

| Path | Contents |
|---|---|
| `profiles/<uid>/` | Profile photos |
| `listings/<uid>/` | Listing photos and videos |
| `chats/<conversationId>/` | Chat photos, videos, voice messages |
| `reviews/<reviewer>/<review>/` | Review photos |
| `verifications/<uid>/` | Student ID photos |
| `reports/` | Report proof photos |

Photos are compressed before upload. Deleted listings/reviews and removed photos are cleaned up by the server; deleting an account removes the user's folders.

### 6.4 Cloud Functions

All in `functions/index.js`, region `asia-southeast1`:

| Function | Trigger | What it does |
|---|---|---|
| `onNewMessage` | new chat message | Notifies the recipient (stacked per chat, conversation layout, sender picture); skips blocked senders; records reply speed |
| `onNewReview` | new review | Notifies the seller ("New review ★★★★★ … for 'item'") |
| `onReviewWrite` | review created/edited/deleted | Recomputes the seller's rating; deletes removed review photos |
| `onUserDocUpdate` | user profile changed | Verification / faculty / ban / restore notifications |
| `onListingStatusChange` | listing updated | Approval/rejection notices, search alerts, price drops, reserved/sold/available notices, sale records + rating prompts, deletes photos removed while editing |
| `onListingDeleted` | listing deleted | Deletes its photos/videos and interested list |
| `checkReservations` | every 6 hours | Reminds at 2 days, releases at 4 days |
| `expireListings` | daily 09:00 (Manila) | Warns at 27 days, expires at 30 |
| `onFeedbackCreated` | new feedback | Notifies admins |
| `onAppealResolved` | appeal decided | Notifies the user |
| `onReportResolved` | report decided | Notifies about warnings, removals, false reports |
| `onAccountDeleted` | login deleted | Deletes the user's profile, listings, reviews, saved items and files |
| `adminDeleteUser` | callable (admins) | Deletes an account from the Admin Panel |
| `listingPage` | HTTPS (via Hosting) | Shared-link page with item preview |

Shared helpers: `notifyUser` (in-app list + push, respecting settings), `sendFcmPush`, `sendExpoPush`, `photoOf` / `letterAvatar`, `deleteStorageUrls`.

### 6.5 Firebase Hosting

`gumacartfinal.web.app` serves:

- `/listing/<id>` → the `listingPage` function (shared links).
- `/.well-known/assetlinks.json` → Android App Links verification.
- `/avatars/…` → letter avatars for notifications.
- `/icon.png`.

---

## 7. How the project developed

The project has 81 commits. Major milestones:

| Date (2026) | Milestone |
|---|---|
| Aug 5–10 | First version of GumaCart |
| Oct 16–21 | Full redesign: theme, shared components, tab navigation, all screens rebuilt; real account deletion; Admin Panel; notification centre; privacy policy; accessibility |
| Oct 22 | Dark mode, push notifications on Android, rating prompts after sales, Sentry, offline banner, share links, reservations, interested buyers, stock quantities, themed dialogs |
| Oct 23 | **SLSU-only accounts**; course and year level; one sheet design; new icon and splash; post-type picker and feature tour |
| Oct 24 | Saved items, search alerts, expiry, zoom, keyboard handling; **simplification for a campus audience** (removed phone numbers and specifications); message reports, blocking, feedback, admin insights |
| Oct 25 | Removed unused features (offers, scheduled meet-ups, follows, cart); chat quick replies, voice messages, mark-sold from chat |
| Oct 26 | All-albums gallery; tappable share links with item previews; listing age from going live; course filter; price limit; form validation |
| Oct 27 | Ratings per purchase; **the notification fixes** (below); review photos; no photo limits |
| Oct 28 | Listing videos (Shopee-style) |
| Oct 29 | SLSU email required for everyone, including admins; About screen banner and team |

### Notable problems and how they were solved

- **Notifications without pictures or stacking.** Investigation showed Expo's push service sends messages in a way that drops the "replace this card" tag and the picture. Fix: send directly through Firebase (§5.9).
- **Phones getting no notifications at all.** The server used the direct route whenever an account had *any* Firebase token, so its other phones were skipped. Fix: pair the tokens per phone.
- **The picture fix had no effect.** Inspecting the built APK showed the build used expo-notifications' **pre-compiled copy**, ignoring the patch. Fix: `buildFromSource`.
- **Notifications missing while the app was open.** The library deliberately drops data-only messages in the foreground. Fix: a patch that passes them to the app's handler.
- **Photos from Messenger/Facebook not in the picker.** Android's new photo picker hides those albums. Fix: the phone's full picker.
- **Monthly build limit on EAS.** Free online builds ran out. Fix: local builds with the same signing key (§8).
- **Shared links not clickable.** `gumacart://` links aren't clickable in Messenger. Fix: `https` links with App Links and a preview page.

Debugging used real-device inspection over USB (`adb`): reading the posted notification (`dumpsys notification`), the phone's log, and the compiled code in the APK.

---

## 8. Building, running and deploying

### Run in development

```bash
npm install                      # also applies the notification patch
npx expo start --go -c           # scan the QR code with Expo Go (SDK 57)
```
Expo Go can't show push notifications or the real icon/splash — use an APK for those. If the phone can't connect, use `--tunnel`.

### Build an APK

Online (EAS, limited per month on the free plan):
```bash
npx eas-cli build --platform android --profile preview
```

On this computer (free, no limit; needs Java 17 and the Android SDK in `~/Android/Sdk`; ~25 minutes):
```bash
env JAVA_HOME=/usr/lib/jvm/java-17-openjdk ANDROID_HOME=$HOME/Android/Sdk \
  npx eas-cli build --platform android --profile preview --local --output ~/gumacart-apk/GumaCart-final.apk
```
Both produce the same APK, signed with the same key (fetched from the Expo account), so they install over each other.

Profiles (`eas.json`): `preview` = APK for testing, `production` = Play Store bundle, `development` = dev client.

### Deploy the backend

```bash
npx firebase-tools deploy --only functions,firestore:rules,firestore:indexes,storage,hosting
```
Cloud Functions need the Firebase **Blaze** plan (Cloud Scheduler for the timed ones).

### Checks before a release

```bash
npm run lint                     # 0 errors expected
npm --prefix functions run lint  # functions syntax
npx expo-doctor                  # dependency health
npx expo export --platform android   # the bundle builds
```

---

## 9. Scripts

| Script | What it does |
|---|---|
| `npm run privacy` (`scripts/export-privacy.js`) | Regenerates `PRIVACY.md` from `constants/privacy.js` |
| `scripts/make-icons.sh` | Generates every app icon from the logo (`scripts/logo.png`) |
| `scripts/make-splash.sh` | Generates the splash images (uses the same logo) |
| `scripts/make-avatars.sh` | Generates the letter avatars in `hosting/avatars/` |
| `scripts/check-push.js <key.json>` | Read-only: which accounts have paired phones (direct notifications) |
| `scripts/delete-non-slsu.js <key.json> [--delete]` | Lists (or deletes) accounts that aren't `@slsu.edu.ph` |
| `scripts/remove-phone-numbers.js <key.json> [--apply]` | One-time: removed phone numbers from old listings |

Scripts that take `<key.json>` need a Firebase **service-account key** (Firebase console → Project settings → Service accounts). **Keep it outside the project, never commit it, and delete it after use** — it gives full access to the project.

---

## 10. Maintenance notes and known limits

- **The notification patch is tied to expo-notifications 57.0.24.** Upgrading that package (or the Expo SDK) means redoing the patch for the new version; otherwise the install fails or the notification features silently disappear. Keep `buildFromSource` in `package.json`.
- **SLSU domain** is declared in two places: `constants/school.js` (app) and `isSlsuEmail()` in `firestore.rules` (server). Change both, then deploy the rules.
- **Play Store release:** build with the `production` profile; add the Play signing certificate's fingerprint to `hosting/.well-known/assetlinks.json`; revisit the security rules (§6.2).
- **Expo Go** on the phone must be the SDK 57 version (newer Expo Go can't open the project). Upgrading the project to SDK 58 is a separate task.
- **Videos** upload uncompressed (a 1-minute video can be 50–150 MB). If storage or data use becomes a problem, add a length limit or lower the recording quality.
- **No limit on photos/videos per listing** — uploads are throttled (3 at a time), and the server cleans up deleted media.
- **Phone battery settings** (OPPO, realme, Honor, Xiaomi) can block notifications for apps swiped away; allow background activity / auto-launch for GumaCart if a phone misses notifications.
- **iOS** is configured but has not been built or tested; the notification patch is Android-only.
- **Conventions:** colours and fonts from `useTheme()`; pop-up forms with `Sheet`; alerts with `AppAlert`; long forms with `KeyboardScrollView`; after editing `constants/privacy.js`, run `npm run privacy`.
