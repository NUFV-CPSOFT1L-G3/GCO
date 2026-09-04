/**
 * Authentication and Role-Based Access Control helper for GCOunsel
 */

async function getCurrentUser() {
  return new Promise((resolve) => {
    if (!window.firebaseAuth) {
      // Fallback if running with mock session in local storage
      const cached = localStorage.getItem("gcounsel_session");
      return resolve(cached ? JSON.parse(cached) : null);
    }

    const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (!user) {
        return resolve(null);
      }

      try {
        // Fetch role and profile from Firestore counselors collection
        if (window.firestoreDb) {
          let doc = await window.firestoreDb.collection("counselors").doc(user.uid).get();
          let profile = doc.exists ? doc.data() : null;

          if (!profile && user.email) {
            try {
              const query = await window.firestoreDb
                .collection("counselors")
                .where("email", "==", user.email.toLowerCase())
                .limit(1)
                .get();
              if (!query.empty) {
                profile = query.docs[0].data();
                await window.firestoreDb.collection("counselors").doc(user.uid).set({ ...profile, id: user.uid }, { merge: true });
              }
            } catch (queryErr) {
              console.warn("Email profile query note:", queryErr.message);
            }
          }

          if (profile) {
            return resolve({
              uid: user.uid,
              email: user.email,
              displayName: profile.name || user.displayName || "Counselor",
              ...profile,
            });
          }
        }
        return resolve({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          role: "counselor",
        });
      } catch (err) {
        console.error("Profile load error:", err);
        resolve({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          role: "counselor",
        });
      }
    });
  });
}

async function requireAuth(expectedRole = null) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  if (expectedRole && user.role !== expectedRole) {
    if (user.role === "admin" && expectedRole === "counselor") {
      // Admin can access counselor screens or admin screens
      return user;
    }
    if (user.role === "counselor" && expectedRole === "admin") {
      alert("Access restricted. This section requires Administrator authorization.");
      window.location.href = "/dashboard.html";
      return null;
    }
  }

  return user;
}

async function handleLogout() {
  try {
    if (window.firebaseAuth) {
      await window.firebaseAuth.signOut();
    }
    localStorage.removeItem("gcounsel_session");
    window.location.href = "/login.html";
  } catch (err) {
    console.error("Logout error:", err);
    window.location.href = "/login.html";
  }
}
