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
  { code: 'BSBA-HR', name: 'BS Business Administration', major: 'Human Resource Development Management' },
  { code: 'BSN', name: 'BS Nursing' },
  { code: 'BSIT-CT', name: 'BS Industrial Technology', major: 'Computer Technology' },
  { code: 'BSEd-SS', name: 'Bachelor of Secondary Education', major: 'Social Studies' },
  { code: 'BSEd-Math', name: 'Bachelor of Secondary Education', major: 'Mathematics' },
  { code: 'Other', name: 'Other / Not listed' },
];

export const YEAR_LEVELS = [1, 2, 3, 4];

export function yearLabel(year) {
  const n = Number(year);
  if (!n) return '';
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} Year`;
}

// Full name, e.g. "BS Industrial Technology, major in Computer Technology".
export function courseName(code) {
  const c = COURSES.find((x) => x.code === code);
  if (!c) return '';
  return c.major ? `${c.name}, major in ${c.major}` : c.name;
}

// One line describing someone, e.g. "BSIT-CT · 3rd Year", "BSN · Faculty",
// or "SLSU Student" for accounts that haven't filled these in yet.
export function academicLabel(profile) {
  const isFaculty = profile?.role === 'faculty';
  const course = profile?.course && profile.course !== 'Other' ? profile.course : '';
  const second = isFaculty ? 'Faculty' : yearLabel(profile?.yearLevel);
  const parts = [course, second].filter(Boolean);
  if (!course) return isFaculty ? 'SLSU Faculty' : parts.length ? `SLSU · ${parts.join(' · ')}` : 'SLSU Student';
  return parts.join(' · ');
}
