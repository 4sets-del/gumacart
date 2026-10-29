import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, reload } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { registerForPushNotifications } from '../utils/notifications';
import { hasSchoolAccess } from '../constants/school';

const AuthContext = createContext({});

// Given a user profile, decide whether they are banned RIGHT NOW.
// Permanent ban: role === 'banned' and bannedUntil is null.
// Temporary ban: role === 'banned' and bannedUntil is in the future.
// Expired ban:   role === 'banned' but bannedUntil is in the past -> NOT banned.
function computeBanState(profile) {
  if (!profile || profile.role !== 'banned') {
    return { banned: false, expired: false };
  }
  const until = profile.bannedUntil;
  if (!until) return { banned: true, expired: false }; // permanent
  const untilDate = until?.toDate ? until.toDate() : new Date(until);
  if (untilDate.getTime() > Date.now()) {
    return { banned: true, expired: false }; // still suspended
  }
  return { banned: false, expired: true };   // suspension has passed
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  // Auto-clear an expired temporary suspension. Permitted by a narrow Firestore
  // rule that only allows self-unban when bannedUntil is in the past.
  const clearExpiredBan = async (uid) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: 'student',
        bannedUntil: null,
        banReason: null,
      });
    } catch (e) {
      console.log('clearExpiredBan skipped:', e?.message);
    }
  };

  const applyProfile = async (uid, data) => {
    const { expired } = computeBanState(data);
    if (expired) {
      await clearExpiredBan(uid);
      setUserProfile({ ...data, role: 'student', bannedUntil: null, banReason: null });
    } else {
      setUserProfile(data);
    }
  };

  useEffect(() => {
    const startTime = Date.now();
    const MIN_SPLASH_MS = 600;

    const finishLoading = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => setLoading(false), remaining);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Load the profile before exposing the user, so the navigator knows
        // their role (admins may use a non-SLSU email) on the first render.
        let profile = null;
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            profile = docSnap.data();
            await applyProfile(firebaseUser.uid, profile);
          }
        } catch (e) {
          console.log('Error fetching profile:', e);
        }
        setUser(firebaseUser);
        setEmailVerified(firebaseUser.emailVerified);
        if (firebaseUser.emailVerified && hasSchoolAccess(firebaseUser)) {
          registerForPushNotifications(firebaseUser.uid);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setEmailVerified(false);
      }
      finishLoading();
    });
    return unsubscribe;
  }, []);

  // Poll for emailVerified updates while logged in but not yet verified
  useEffect(() => {
    if (!user || emailVerified) return;
    const interval = setInterval(async () => {
      try {
        await reload(auth.currentUser);
        if (auth.currentUser?.emailVerified) {
          setEmailVerified(true);
          setUser({ ...auth.currentUser });
          registerForPushNotifications(auth.currentUser.uid);
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [user, emailVerified]);

  // Listen to the profile so a mid-session ban (or unban) takes effect
  // immediately. Firestore only sends data when the document changes, unlike
  // the old 20-second polling which re-downloaded it ~180 times an hour.
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => { if (snap.exists()) applyProfile(uid, snap.data()); },
      () => {},
    );
  }, [uid]);

  // A temporary suspension ends at a set time without any document change,
  // so schedule a re-check for that moment.
  useEffect(() => {
    if (!uid || userProfile?.role !== 'banned' || !userProfile?.bannedUntil) return;
    const until = userProfile.bannedUntil?.toDate ? userProfile.bannedUntil.toDate() : new Date(userProfile.bannedUntil);
    const ms = until.getTime() - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(() => applyProfile(uid, userProfile), Math.min(ms + 1000, 2147483647));
    return () => clearTimeout(id);
  }, [uid, userProfile]);

  const { banned: isBanned } = computeBanState(userProfile);
  const schoolAccess = hasSchoolAccess(user);

  return (
    <AuthContext.Provider value={{ user, userProfile, setUserProfile, loading, emailVerified, isBanned, schoolAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
