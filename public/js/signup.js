/**
 * Counselor Sign-up Controller & Validation for GCOunsel
 * Adheres to Lab Activity 8: Testing and Form Validation
 */

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const fullnameInput = document.getElementById("fullname");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const titleInput = document.getElementById("title");
  const credentialsInput = document.getElementById("credentials");
  const submitBtn = document.getElementById("signupSubmitBtn");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  // Toggle password visibility
  const togglePassBtn = document.getElementById("togglePasswordBtn");
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      togglePassBtn.textContent = isHidden ? "Hide" : "Show";
    });
  }

  const toggleConfirmPassBtn = document.getElementById("toggleConfirmPasswordBtn");
  if (toggleConfirmPassBtn && confirmPasswordInput) {
    toggleConfirmPassBtn.addEventListener("click", () => {
      const isHidden = confirmPasswordInput.type === "password";
      confirmPasswordInput.type = isHidden ? "text" : "password";
      toggleConfirmPassBtn.textContent = isHidden ? "Hide" : "Show";
    });
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.textContent = "";
    successMsg.style.display = "none";
    successMsg.textContent = "";

    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const title = titleInput ? titleInput.value.trim() : "Guidance Counselor";
    const credentials = credentialsInput ? credentialsInput.value.trim() : "RGC";

    // 1. Validation: Empty required fields
    if (!fullname) {
      errorMsg.textContent = "Full name is required. Please enter your name.";
      fullnameInput.focus();
      return;
    }

    if (!email) {
      errorMsg.textContent = "Email is required. Please enter your institutional email.";
      emailInput.focus();
      return;
    }

    // 2. Validation: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorMsg.textContent = "Invalid email format. Please enter a valid email address (e.g. name@school.edu.ph).";
      emailInput.focus();
      return;
    }

    // 3. Validation: Password empty and minlength (Lab 8 requires minlength="8")
    if (!password) {
      errorMsg.textContent = "Password is required. Please enter a password.";
      passwordInput.focus();
      return;
    }

    if (password.length < 8) {
      errorMsg.textContent = "Password does not meet requirements. Password must be at least 8 characters long.";
      passwordInput.focus();
      return;
    }

    // 4. Validation: Password mismatch
    if (password !== confirmPassword) {
      errorMsg.textContent = "Password confirmation does not match the entered password.";
      confirmPasswordInput.focus();
      return;
    }

    // Form submission processing
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Account...";

    try {
      // Check duplicate in local storage mock / demo list
      const existingAccounts = JSON.parse(localStorage.getItem("gcounsel_registered_counselors") || "[]");
      const isDuplicate = existingAccounts.some((acc) => acc.email.toLowerCase() === email) ||
        email === "kyle.carandang@nu-fairview.edu.ph" ||
        email === "admin@nu-fairview.edu.ph" ||
        email === "a.reyes@school.edu.ph";

      if (isDuplicate) {
        throw new Error("This email is already registered. Please log in or use a different email address.");
      }

      // Try creating via Netlify Function API
      let created = false;
      try {
        const response = await fetch("/api/admin-counselors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullname,
            email,
            password,
            title,
            credentials,
          }),
        });

        if (response.ok) {
          created = true;
        } else {
          const resData = await response.json().catch(() => ({}));
          if (resData.error && resData.error.toLowerCase().includes("already")) {
            throw new Error(resData.error);
          }
        }
      } catch (apiErr) {
        if (apiErr.message.toLowerCase().includes("already")) {
          throw apiErr;
        }
        console.warn("API registration notice (fallback to local session):", apiErr.message);
      }

      // Save to client-side registered list for demonstration & local workflow
      const newAccount = {
        id: "counselor_" + Date.now(),
        name: fullname,
        email,
        title,
        credentials,
        role: "counselor",
      };
      existingAccounts.push(newAccount);
      localStorage.setItem("gcounsel_registered_counselors", JSON.stringify(existingAccounts));

      // Success message & redirect
      successMsg.textContent = "Account successfully registered! Redirecting to login...";
      successMsg.style.display = "block";
      signupForm.reset();

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1500);
    } catch (err) {
      errorMsg.textContent = err.message || "Failed to create account. Please try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  });
});
