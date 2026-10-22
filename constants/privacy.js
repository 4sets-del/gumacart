// Privacy Policy text, shown in the app (PrivacyScreen) and exported to
// PRIVACY.md (scripts/export-privacy.js) for hosting on the web, which
// Google Play requires. Keep it in sync with what the app actually does.

// Public contact address for privacy questions and data requests.
export const PRIVACY_CONTACT = 'slsugumacart@gmail.com';
export const PRIVACY_EFFECTIVE = 'October 21, 2026';

export const PRIVACY_INTRO =
  'SLSU-GumaCart ("GumaCart", "we") is a campus marketplace for students and faculty of Southern Luzon State University – Gumaca Campus. This policy explains what information the app collects, how it is used, who can see it, and the choices you have. We handle personal information in line with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).';

export const PRIVACY_SECTIONS = [
  {
    title: 'Information you give us',
    points: [
      'Account details: your name, SLSU email address (@slsu.edu.ph, required to sign up), address, age, and whether you signed up as a student or requested faculty status. Your password is handled by Firebase Authentication; we never see it.',
      'Seller verification: your student ID number and a photo of your student ID, which admins use to confirm your identity before you can post listings.',
      'Profile photo, if you add one.',
      'Listings: photos, title, description, specifications, price, category, condition, meet-up location and the contact number you enter.',
      'Messages, including photos and videos you send in chat.',
      'Reviews and ratings you write, the people you follow, items in your cart, reports and ban appeals.',
    ],
  },
  {
    title: 'Information collected automatically',
    points: [
      'A push notification token for your device, so we can send you notifications. It is removed from your account when you log out.',
      'Your recent searches, saved to your account so you can reuse them.',
      'How many times a listing is viewed (a simple count; we do not record who viewed it).',
      'The most recent listings are stored on your phone so the app opens faster. They are cleared when you log out.',
      'If the app crashes, a crash report with technical details (device model, Android/iOS version, app version and the error) may be sent so we can fix the problem. It does not include your name, email, messages or listings.',
    ],
  },
  {
    title: 'How we use your information',
    points: [
      'To run the marketplace: show listings, let buyers and sellers chat, and keep carts, follows and reviews.',
      'To verify that users are SLSU students or faculty, and to review listings before they go live.',
      'To send notifications you have not turned off (new messages, followers and reviews can be switched off in Settings; account and listing notices are always sent).',
      'To keep the community safe: handle reports, suspensions and appeals.',
      'We do not sell your information and we do not show ads.',
    ],
  },
  {
    title: 'Who can see your information',
    points: [
      'Other signed-in users can see your name, profile photo, email address, verified/faculty badges, ratings and reviews, follower counts, and your active listings, including the contact number and meet-up location on them.',
      'Messages are shown to the people in that conversation.',
      'Admins can see verification details (school email, student ID number, ID photo), reports, appeals and account status in order to moderate the app.',
      'Your address and age are kept on your account and are not shown on your profile.',
    ],
  },
  {
    title: 'Service providers',
    points: [
      'Google Firebase (Authentication, Cloud Firestore, Cloud Storage and Cloud Functions) stores the app’s data and runs its server code on Google Cloud.',
      'Expo’s push notification service delivers notifications to your phone.',
      'Sentry receives crash reports, if crash reporting is enabled in the app.',
      'These providers process data on our behalf under their own security and privacy terms.',
    ],
  },
  {
    title: 'How long we keep it',
    points: [
      'We keep your information while your account exists.',
      'When you delete your account (Settings → Delete account), we delete your login, profile, listings and their photos, profile photo, student ID photo, reviews you wrote or received, follows, cart and notifications.',
      'Conversations are kept so the other person still has their chat history; your messages in them remain.',
      'If an admin removes your account, the same deletion happens.',
    ],
  },
  {
    title: 'Your choices and rights',
    points: [
      'Access and correct your details any time in Settings → Edit Profile.',
      'Turn notification types on or off in Settings.',
      'Remove a conversation from your inbox, delete your listings or reviews, and unfollow people.',
      'Delete your account and its data from Settings.',
      `Under the Data Privacy Act you may also ask us about the personal data we hold about you by contacting ${PRIVACY_CONTACT}.`,
    ],
  },
  {
    title: 'Security',
    points: [
      'Data is sent over encrypted connections and stored on Google Cloud, which encrypts stored data. No system is perfectly secure, so please don’t share sensitive information you wouldn’t want others to see, and meet buyers and sellers in safe, public places on campus.',
    ],
  },
  {
    title: 'Young users',
    points: [
      'GumaCart is meant for SLSU students and faculty. If you are under 18, please use the app with the knowledge of a parent or guardian.',
    ],
  },
  {
    title: 'Changes to this policy',
    points: [
      'We may update this policy as the app changes. We will update the date above and, for important changes, let you know in the app.',
    ],
  },
  {
    title: 'Contact',
    points: [`Questions or requests about your data: ${PRIVACY_CONTACT}.`],
  },
];
