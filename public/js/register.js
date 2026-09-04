const registerPasswordInput = document.getElementById("password");
const registerPasswordToggle = document.querySelector(".toggle-password");

if (registerPasswordToggle && registerPasswordInput) {
  registerPasswordToggle.addEventListener("click", () => {
    const isHidden = registerPasswordInput.type === "password";
    registerPasswordInput.type = isHidden ? "text" : "password";
    registerPasswordToggle.textContent = isHidden ? "Hide" : "Show";
  });
}

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const errorMessage = document.getElementById("errorMsg");
  errorMessage.textContent = "";

  const name = document.getElementById("name").value.trim();
  const title = document.getElementById("title").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await api.post("/api/auth/register", { name, title, email, password });
    window.location.href = "/login.html";
  } catch (error) {
    errorMessage.textContent = error.message;
  }
});
