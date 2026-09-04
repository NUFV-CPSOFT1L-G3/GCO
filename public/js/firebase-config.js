/**
 * Firebase Client Configuration for GCOunsel
 * Connected to project: gcounsel-nu
 */
const firebaseConfig = window.__FIREBASE_CONFIG__ || {
  apiKey: "AIzaSyBoI7x4XKOS2e0dIj37EQ-YZLy1pXZ0a6k",
  authDomain: "gcounsel-nu.firebaseapp.com",
  projectId: "gcounsel-nu",
  storageBucket: "gcounsel-nu.firebasestorage.app",
  messagingSenderId: "778917958612",
  appId: "1:778917958612:web:139a825be36b2c5d78fc41",
  measurementId: "G-JS4GPKC1JQ",
};

// Initialize Firebase if compat library is present
let auth = null;
let db = null;

if (typeof firebase !== "undefined") {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (err) {
    console.warn("Firebase initialization note:", err.message);
  }
}

window.firebaseAuth = auth;
window.firestoreDb = db;
