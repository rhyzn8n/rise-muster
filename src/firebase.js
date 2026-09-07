import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// This config is read from Vite env vars, never hardcoded — same convention
// Rise Lead Importer already uses (VITE_FIREBASE_*). Set these in Vercel:
// Project Settings -> Environment Variables. Values come from the KAKAW
// project's own Firebase config (Job Docket's or SEO Pulse's firebase.js
// already has this exact block — copy the values from there).
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, // should be "kakaw-2d31c"
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

const provider = new GoogleAuthProvider()

export function loginWithGoogle() {
  return signInWithPopup(auth, provider)
}

export function logout() {
  return signOut(auth)
}

export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback)
}
