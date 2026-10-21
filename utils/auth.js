import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { unregisterPushToken } from './notifications';

// Sign out and detach this phone's push token from the account first, so the
// next person to log in on this phone doesn't receive the previous user's
// notifications.
export async function signOutUser() {
  const uid = auth.currentUser?.uid;
  await unregisterPushToken(uid);
  await signOut(auth);
}
