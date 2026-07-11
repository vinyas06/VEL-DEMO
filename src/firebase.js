import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyD1DfOI2oqbP22VFbTcwWXpcO8O_94QI1s",
  authDomain: "vel-demo-80846.firebaseapp.com",
  projectId: "vel-demo-80846",
  storageBucket: "vel-demo-80846.firebasestorage.app",
  messagingSenderId: "958400204183",
  appId: "1:958400204183:web:d6d3439cddc7d92c11c8d2",
  measurementId: "G-45W1VBJNLT"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 🔥 Initialize App Check Security Firewall
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_RECAPTCHA_KEY),
  isTokenAutoRefreshEnabled: true
});

export const db = getFirestore(app);
export const storage = getStorage(app);
