import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA6SXo1TLK-2A1rQHnEAPiCUHWlWQdafvQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "msme-risk-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "msme-risk-ai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "msme-risk-ai.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "382218761380",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:382218761380:web:8f10850e4a2bf30b07a231",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DHBT88CWT0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom Google Auth Provider configuration
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

