import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyC47xZb_sfiq6ZZgdfNHPIGjwNPb2YFdn0",
  authDomain: "veerashiava-express-logistics.firebaseapp.com",
  projectId: "veerashiava-express-logistics",
  storageBucket: "veerashiava-express-logistics.firebasestorage.app",
  messagingSenderId: "1062301466907",
  appId: "1:1062301466907:web:75cd22040c099c52ce13be",
  measurementId: "G-RLQT2RC01N"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 🔥 Initialize App Check Security Firewall
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6LcNdPosAAAAADU6FBJeu2X9otwmNdMHRA7XIcUU'),
  isTokenAutoRefreshEnabled: true
});

export const db = getFirestore(app);
export const storage = getStorage(app);
