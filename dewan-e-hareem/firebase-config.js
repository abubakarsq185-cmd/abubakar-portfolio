/* ============================================================
   Dewan-e-Hareem — Firebase configuration
   ------------------------------------------------------------
   Paste the 6 values from your Firebase project:
   Firebase console → Project settings (gear) → "Your apps" → Web app → SDK config.

   Until real values are filled in here, the website runs in secure
   LOCAL mode (username + password login stored hashed in the browser).
   The moment you paste your real keys and deploy, the site automatically
   switches to Firebase: real Google + email login, password reset by email,
   and a cloud menu that every visitor sees live.
   ============================================================ */
window.DEH_FIREBASE = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

/* Owner allowlist — ONLY these emails may sign in as owner and edit the menu.
   Use the SAME email(s) you add as users in Firebase Authentication, and the
   SAME email inside firestore.rules. Everyone else is rejected. */
window.DEH_OWNERS = [
  "PASTE_OWNER_EMAIL@example.com"
];
