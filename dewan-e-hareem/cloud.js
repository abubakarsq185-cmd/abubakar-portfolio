/* ============================================================
   Dewan-e-Hareem — Firebase cloud layer (Auth + Firestore)
   Dormant until firebase-config.js has real keys. When configured:
     • Real owner login — email/password + Google + email password-reset
     • A cloud menu (Firestore) that syncs live to every visitor
   Talks to the site through the window.DEH hooks defined in main.js.
   The Firebase SDK is only downloaded when real keys are present.
   ============================================================ */
(function () {
  "use strict";
  var cfg = (window.DEH_FIREBASE) || {};
  if (!cfg.apiKey || /PASTE|YOUR_/.test(cfg.apiKey)) {
    console.info("[Dewan-e-Hareem] Firebase not configured — running in secure local mode.");
    return;
  }
  var V = "https://www.gstatic.com/firebasejs/10.12.0/";
  Promise.all([
    import(V + "firebase-app.js"),
    import(V + "firebase-auth.js"),
    import(V + "firebase-firestore.js")
  ]).then(function (m) {
    var A = m[0], AU = m[1], FS = m[2];
    var app = A.initializeApp(cfg);
    var auth = AU.getAuth(app);
    var db = FS.getFirestore(app);
    var COL = "menuOverrides";

    function friendly(e) {
      var c = (e && e.code) || "";
      var map = {
        "auth/invalid-email": "That email address looks invalid.",
        "auth/user-not-found": "No owner account found with that email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts — please try again shortly.",
        "auth/popup-closed-by-user": "Google sign-in was cancelled.",
        "auth/network-request-failed": "Network error — check your connection.",
        "auth/requires-recent-login": "Please log out and back in, then change your password."
      };
      return map[c] || (e && e.message) || "Something went wrong.";
    }

    window.DEHCloud = {
      enabled: true,
      login: function (email, pass) { return AU.signInWithEmailAndPassword(auth, email, pass); },
      google: function () { return AU.signInWithPopup(auth, new AU.GoogleAuthProvider()); },
      reset: function (email) { return AU.sendPasswordResetEmail(auth, email); },
      changePass: function (np) {
        if (!auth.currentUser) return Promise.reject({ code: "auth/requires-recent-login" });
        if (!np || np.length < 6) return Promise.reject({ message: "Password must be at least 6 characters." });
        return AU.updatePassword(auth.currentUser, np);
      },
      logout: function () { return AU.signOut(auth); },
      save: function (id, obj) { return FS.setDoc(FS.doc(db, COL, String(id)), obj, { merge: true }); },
      remove: function (id) { return FS.deleteDoc(FS.doc(db, COL, String(id))); },
      friendly: friendly
    };

    AU.onAuthStateChanged(auth, function (user) {
      if (!window.DEH) return;
      if (user) window.DEH.enterAdmin(); else window.DEH.exitAdmin();
    });

    FS.onSnapshot(FS.collection(db, COL), function (snap) {
      var mapObj = {};
      snap.forEach(function (d) { mapObj[d.id] = d.data(); });
      if (window.DEH && window.DEH.applyCloudMap) window.DEH.applyCloudMap(mapObj);
    }, function (err) { console.warn("[Dewan-e-Hareem] menu sync error:", err); });

    console.info("[Dewan-e-Hareem] Firebase connected — owner login & cloud menu active.");
  }).catch(function (e) {
    console.error("[Dewan-e-Hareem] Firebase failed to load; staying in local mode.", e);
  });
})();
