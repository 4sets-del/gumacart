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
