import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {

  apiKey: "AIzaSyCQN3AeUqj4lEu-uw3XXX7bAKKhsbP4jh4",

  authDomain: "gumacartfinal.firebaseapp.com",

  projectId: "gumacartfinal",

  storageBucket: "gumacartfinal.firebasestorage.app",

  messagingSenderId: "266559215480",

  appId: "1:266559215480:web:da715d9c0ddf526ed75a8d"

};


const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
