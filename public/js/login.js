const loginPasswordInput = document.getElementById("password");
const loginPasswordToggle = document.querySelector(".toggle-password");

if (loginPasswordToggle && loginPasswordInput) {
  loginPasswordToggle.addEventListener("click", () => {
    const isHidden = loginPasswordInput.type === "password";
    loginPasswordInput.type = isHidden ? "text" : "password";
    loginPasswordToggle.textContent = isHidden ? "Hide" : "Show";
  });
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const errorMessage = document.getElementById("errorMsg");
  const submitBtn = document.getElementById("loginSubmitBtn");
  errorMessage.textContent = "";

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging In...";

  try {
    let userProfile = null;

    if (window.firebaseAuth) {
      try {
        const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (window.firestoreDb) {
          try {
            const doc = await window.firestoreDb.collection("counselors").doc(user.uid).get();
            if (doc.exists) {
              userProfile = doc.data();
            } else if (user.email) {
              const emailQuery = await window.firestoreDb
                .collection("counselors")
                .where("email", "==", user.email.toLowerCase())
                .limit(1)
                .get();
              if (!emailQuery.empty) {
                userProfile = emailQuery.docs[0].data();
              }
            }
          } catch (dbErr) {
            console.warn("Firestore profile fetch notice:", dbErr);
          }
        }

        if (!userProfile) {
          userProfile = {
            id: user.uid,
            email: user.email,
            name: user.displayName || (user.email ? user.email.split("@")[0] : "Counselor"),
            role: (user.email && user.email.toLowerCase().includes("admin")) ? "admin" : "counselor",
          };
        }
      } catch (fbErr) {
        console.error("Firebase Auth error:", fbErr);
        if (
          fbErr.code === "auth/wrong-password" ||
          fbErr.code === "auth/user-not-found" ||
          fbErr.code === "auth/invalid-credential" ||
          fbErr.code === "auth/invalid-email"
        ) {
          throw new Error("Invalid email or password. Please verify your credentials.");
        } else if (fbErr.code === "auth/too-many-requests") {
          throw new Error("Access temporarily disabled due to many failed login attempts. Please reset password or try again shortly.");
        } else if (fbErr.code === "auth/api-key-not-valid") {
          throw new Error("Firebase API key is invalid. Please refresh the page.");
        } else {
          throw new Error(fbErr.message || "Failed to sign in with Firebase.");
        }
      }
    }

    // Fallback: check seeded credentials in demo/offline mode
    if (!userProfile) {
      if ((email === "kyle.carandang@nu-fairview.edu.ph" || email === "a.reyes@school.edu.ph") && password === "guidance123") {
        userProfile = {
          id: "counselor_kyle_001",
          name: "Kyle Carandang",
          email: "kyle.carandang@nu-fairview.edu.ph",
          title: "Guidance Counselor",
          credentials: "RGC",
          role: "counselor",
        };
      } else if ((email === "admin@nu-fairview.edu.ph" || email === "admin@school.edu.ph") && password === "admin123") {
        userProfile = {
          id: "admin_kyle_001",
          name: "Kyle Carandang",
          email: "admin@nu-fairview.edu.ph",
          title: "GCO Administrator",
          role: "admin",
        };
      } else {
        throw new Error("Invalid email or password.");
      }
    }

    // Save session locally for persistence
    localStorage.setItem("gcounsel_session", JSON.stringify(userProfile));

    // Determine redirect
    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get("redirect");

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else if (userProfile.role === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/dashboard.html";
    }
  } catch (error) {
    errorMessage.textContent = error.message || "Failed to log in.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
  }
});

// Microsoft / NU Institutional Account Sign-In Handler
const microsoftLoginBtn = document.getElementById("microsoftLoginBtn");
if (microsoftLoginBtn) {
  microsoftLoginBtn.addEventListener("click", async () => {
    const errorMessage = document.getElementById("errorMsg");
    errorMessage.textContent = "";

    if (!window.firebaseAuth) {
      errorMessage.textContent = "Firebase is not loaded. Please verify your connection or use password login.";
      return;
    }

    try {
      const provider = new firebase.auth.OAuthProvider("microsoft.com");
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await window.firebaseAuth.signInWithPopup(provider);
      const user = result.user;
      const userEmail = (user.email || "").toLowerCase();

      // Enforce domain separation: students cannot access staff portal
      if (userEmail.endsWith("@students.nu-fairview.edu.ph")) {
        await window.firebaseAuth.signOut();
        errorMessage.textContent = "Access denied: Student accounts (@students.nu-fairview.edu.ph) cannot log into the Guidance Office staff portal. Please use the public Student Booking Portal.";
        return;
      }

      // Check or create counselor record in Firestore
      let userProfile = null;
      if (window.firestoreDb) {
        const docRef = window.firestoreDb.collection("counselors").doc(user.uid);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          userProfile = docSnap.data();
        } else {
          // Auto-provision staff counselor record
          const defaultWeeklyHours = [
            { dayOfWeek: 0, isActive: false, startTime: "08:00", endTime: "17:00" },
            { dayOfWeek: 1, isActive: true, startTime: "08:00", endTime: "17:00" },
            { dayOfWeek: 2, isActive: true, startTime: "08:00", endTime: "17:00" },
            { dayOfWeek: 3, isActive: true, startTime: "08:00", endTime: "17:00" },
            { dayOfWeek: 4, isActive: true, startTime: "08:00", endTime: "17:00" },
            { dayOfWeek: 5, isActive: true, startTime: "08:00", endTime: "17:00" },
            { dayOfWeek: 6, isActive: false, startTime: "08:00", endTime: "12:00" },
          ];

          userProfile = {
            id: user.uid,
            name: user.displayName || userEmail.split("@")[0],
            email: userEmail,
            title: "Guidance Counselor",
            credentials: "RGC",
            role: "counselor",
            preferredAreas: ["Academic", "Career", "Personal", "Mental Wellness"],
            sessionsHandled: 0,
            sessionsCompleted: 0,
            defaultDurationMinutes: 30,
            weeklyHours: defaultWeeklyHours,
            blockedDates: [],
            createdAt: new Date().toISOString(),
          };

          await docRef.set(userProfile);
        }
      }

      localStorage.setItem("gcounsel_session", JSON.stringify(userProfile || { uid: user.uid, email: userEmail, role: "counselor" }));

      if (userProfile && userProfile.role === "admin") {
        window.location.href = "/admin.html";
      } else {
        window.location.href = "/dashboard.html";
      }
    } catch (err) {
      console.error("Microsoft sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        return; // User closed popup intentionally
      }
      if (err.code === "auth/operation-not-supported-in-this-environment" || err.code === "auth/configuration-not-found") {
        errorMessage.textContent = "Microsoft provider requires Azure App credentials. Please use the email & password form below or configure Microsoft in Firebase Console.";
      } else {
        errorMessage.textContent = err.message || "Failed to sign in with Microsoft.";
      }
    }
  });
}

