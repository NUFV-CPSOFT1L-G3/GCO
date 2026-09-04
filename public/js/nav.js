/**
 * Shared Navigation Component for GCOunsel
 */

function renderNav(activeKey, user) {
  const isAdmin = user && user.role === "admin";

  const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard.html", icon: "⊞" },
    { key: "schedule", label: "Calendar & Schedule", href: "/schedule.html", icon: "📅" },
    { key: "availability", label: "Availability Settings", href: "/availability.html", icon: "⚙" },
  ];

  const externalLinks = [
    { key: "portal", label: "Student Booking Portal", href: "/index.html", icon: "↗" },
  ];

  if (isAdmin) {
    navItems.unshift({ key: "admin", label: "Admin Analytics", href: "/admin.html", icon: "📊" });
  }

  return `
    <header class="mainHeader">
      <div class="headerLeft">
        <button class="appGridButton" type="button" aria-label="Toggle navigation" id="navToggleBtn">
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
        </button>
        <a href="/dashboard.html" class="brandName" style="color:#fff; text-decoration:none;">GCOunsel</a>
      </div>
      <div class="headerRight">
        <div class="userGreeting">Hi, ${escapeHtml(user.displayName || user.name || "Counselor")}</div>
        <div class="userAvatar" title="${escapeHtml(user.email || "")}">
          ${(user.displayName || user.name || "C")[0].toUpperCase()}
        </div>
      </div>
    </header>

    <div class="workspace-shell">
      <aside class="side-nav" id="sideNav">
        <div class="nav-section">
          <div class="navLabel">COUNSELOR NAVIGATION</div>
          ${navItems
            .map(
              (item) => `
                <a class="navLink ${item.key === activeKey ? "active" : ""}" href="${item.href}">
                  <span class="nav-icon">${item.icon}</span>
                  <span>${item.label}</span>
                </a>
              `
            )
            .join("")}
        </div>

        <div class="nav-section">
          <div class="navLabel">PUBLIC LINKS</div>
          ${externalLinks
            .map(
              (item) => `
                <a class="navLink" href="${item.href}" target="_blank">
                  <span class="nav-icon">${item.icon}</span>
                  <span>${item.label}</span>
                </a>
              `
            )
            .join("")}
        </div>

        <div class="nav-section" style="margin-top: auto;">
          <div class="navLabel">ACCOUNT</div>
          <a class="navLink navLinkUtility" id="logoutLink" href="#">
            <span class="nav-icon">🚪</span>
            <span>Log Out</span>
          </a>
        </div>
      </aside>

      <div class="contentArea">
  `;
}

function attachNavHandlers() {
  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleLogout();
    });
  }

  const navToggleBtn = document.getElementById("navToggleBtn");
  const sideNav = document.getElementById("sideNav");
  if (navToggleBtn && sideNav) {
    navToggleBtn.addEventListener("click", () => {
      sideNav.classList.toggle("open");
    });
  }
}

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
