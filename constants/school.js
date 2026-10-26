// GumaCart is only for the SLSU community: accounts must use an institutional
// email. (Keep in sync with isSlsuEmail() in firestore.rules.)
export const SCHOOL_DOMAIN = 'slsu.edu.ph';

export function isSchoolEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`);
}

// Admins may use any email (e.g. the project owner's account).
export function hasSchoolAccess(user, profile) {
  return isSchoolEmail(user?.email) || profile?.role === 'admin';
}

// Courses (with majors) offered at SLSU Gumaca. The short code is what shows
// on profiles, listings and chats; edit this list if the offerings change.
export const COURSES = [
  { code: 'BSBA-HRM', name: 'BS Business Administration', major: 'Human Resource Management' },
  { code: 'BSN', name: 'BS Nursing' },
  { code: 'BSIT-CPT', name: 'BS Industrial Technology', major: 'Computer Technology' },
  { code: 'BSEd-SS', name: 'Bachelor of Secondary Education', major: 'Social Studies' },
  { code: 'BSEd-Math', name: 'Bachelor of Secondary Education', major: 'Mathematics' },
  { code: 'Other', name: 'Other / Not listed' },
];

// Codes that were renamed; profiles saved before keep the old code and are
// read as the new one.
const RENAMED_COURSES = { 'BSBA-HR': 'BSBA-HRM', 'BSIT-CT': 'BSIT-CPT' };

export function normalizeCourse(code) {
  return RENAMED_COURSES[code] || code || null;
}

export const YEAR_LEVELS = [1, 2, 3, 4];

// Allowed ages on Sign Up and Edit Profile (students and faculty).
export const MIN_AGE = 12;
export const MAX_AGE = 100;
export const isValidAge = (age) => Number.isInteger(Number(age)) && Number(age) >= MIN_AGE && Number(age) <= MAX_AGE;

export function yearLabel(year) {
  const n = Number(year);
  if (!n) return '';
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} Year`;
}

// Full name, e.g. "BS Industrial Technology, major in Computer Technology".
export function courseName(code) {
  const c = COURSES.find((x) => x.code === normalizeCourse(code));
  if (!c) return '';
  return c.major ? `${c.name}, major in ${c.major}` : c.name;
}

// One line describing someone, e.g. "BSIT-CPT · 3rd Year", "BSN · Faculty",
// or "SLSU Student" for accounts that haven't filled these in yet.
export function academicLabel(profile) {
  const isFaculty = profile?.role === 'faculty';
  const code = normalizeCourse(profile?.course);
  const course = code && code !== 'Other' ? code : '';
  const second = isFaculty ? 'Faculty' : yearLabel(profile?.yearLevel);
  const parts = [course, second].filter(Boolean);
  if (!course) return isFaculty ? 'SLSU Faculty' : parts.length ? `SLSU · ${parts.join(' · ')}` : 'SLSU Student';
  return parts.join(' · ');
}

// Campus meet-up spots, used for a listing's meet-up place.
export const MEETUP_SPOTS = ['Library', 'Main Gate', 'Admin Office', 'Dormitory', 'Other'];

// Posting rules: anyone may post "Looking For" (a request; nobody receives
// anything from it). Selling, bartering and donating hand items to other
// students, so they need a verified student ID (admins are exempt).
export const OPEN_POST_TYPES = ['buy'];

export function isVerifiedPoster(profile) {
  return profile?.verificationStatus === 'verified' || profile?.role === 'admin';
}

export function canPostType(profile, type) {
  return OPEN_POST_TYPES.includes(type) || isVerifiedPoster(profile);
}
