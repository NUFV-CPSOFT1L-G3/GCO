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
  errorMessage.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await api.post("/api/auth/login", { email, password });
    window.location.href = "/dashboard.html";
  } catch (error) {
    errorMessage.textContent = error.message;
  }
});
