# Connect the Owner section to Firebase (real cloud database + login)

The site already works in **local mode** (username `owner` / password `hareem2026`).
To switch on **real Google + email login, email password-reset, and a cloud menu
that every visitor sees live**, connect a free Firebase project. ~5–10 minutes.

## 1. Create the project
1. Go to https://console.firebase.google.com → **Add project** → name it (e.g. `dewan-e-hareem`) → create.

## 2. Add a Web app & copy the keys
1. In the project, click the **Web** icon `</>` → register an app.
2. Copy the `firebaseConfig` values and paste them into **`firebase-config.js`**
   (replace every `PASTE_…`): `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`.

## 3. Turn on Authentication
1. **Build → Authentication → Get started**.
2. **Sign-in method** tab → enable **Email/Password**, and enable **Google**.
3. **Users** tab → **Add user** → create the owner's email + password (this is the login).
4. **Settings → Authorized domains** → add your live domain (e.g. `dewanehareem.com`)
   and `localhost` for testing.

## 4. Create the database
1. **Build → Firestore Database → Create database** → **Production mode** → pick a region.
2. Open the **Rules** tab, paste the contents of **`firestore.rules`**, and **Publish**.
   (Read = everyone; Write = only the signed-in owner.)

## 5. Deploy & test
1. Upload the site (with your filled-in `firebase-config.js`) to your host over **https**.
2. Open the site → **Owner login** → sign in with the email/password (or Google).
3. Edit a dish's photo/name/price → it saves to Firestore and updates **for every visitor, instantly** — no export step.
4. **Forgot password** sends a real reset email.

## Notes
- Until real keys are in `firebase-config.js`, the site stays in local mode automatically — nothing breaks.
- Menu edits (incl. photos, stored compressed) live in the `menuOverrides` collection.
- Security: only authenticated owners can write; the API key in `firebase-config.js` is safe to be public (Firebase keys are identifiers, not secrets — access is controlled by the rules + authorized domains).
- Phone/SMS login can be added later (needs the Blaze plan + reCAPTCHA); email + Google cover most needs on the free Spark plan.
