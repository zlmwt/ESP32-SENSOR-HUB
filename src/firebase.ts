import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue } from 'firebase/database';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Explicitly pass the databaseURL to ensure it connects to the correct regional instance
// If databaseURL is missing from config, it will fallback to default
const databaseURL = firebaseConfig.databaseURL;
export const db = getDatabase(app, databaseURL);
export const auth = getAuth(app);

console.log(`[Firebase] Initialized with database: ${databaseURL || 'default'}`);

// Monitor connection status
onValue(ref(db, '.info/connected'), (snapshot) => {
  if (snapshot.val() === true) {
    console.log("[Firebase] Realtime Database connected successfully.");
  } else {
    console.warn("[Firebase] Realtime Database disconnected. Please check your configuration and internet connection.");
  }
}, (error) => {
  console.error("[Firebase] Connection error:", error.message);
});
