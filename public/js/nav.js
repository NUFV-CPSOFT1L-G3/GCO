const NAV_GROUPS = [
  {
    title: "AVAILABLE",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard.html" },
      { key: "schedule", label: "Schedule", href: "/schedule.html" },
      { key: "availability", label: "Availability", href: "/availability.html" },
    ],
  },
  {
    title: "UNAVAILABLE",
    items: [
      { key: "requests", icon: "", label: "Requests", href: "/coming-soon.html" },
      { key: "students", icon: "", label: "Students", href: "/coming-soon.html" },
      { key: "analytics", icon: "", label: "Analytics", href: "/coming-soon.html" },
      { key: "settings", icon: "", label: "Settings", href: "/coming-soon.html" },
    ],
  },
];

function renderNav(activeKey, counselor) {
  return `
    <div class="mainHeader">
      <div class="headerLeft">
        <button class="appGridButton" type="button" aria-label="Toggle navigation">
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
        </button>
        <div class="brandName">NU GCO</div>
      </div>
      <div class="headerRight">
        <div class="userGreeting">Hi, ${escapeHtml(counselor.name)}</div>
        <div class="userAvatar"></div>
      </div>
    </div>

    <div class="workspace-shell">
      <aside class="side-nav">
        <div class="nav-section">
          <div class="navLabel">${NAV_GROUPS[0].title}</div>
          ${NAV_GROUPS[0].items
            .map(
              (item) => `
                <a class="navLink ${item.key === activeKey ? "active" : ""}" href="${item.href}">
                  <span class="nav-icon">${item.icon || "•"}</span>
                  <span>${item.label}</span>
                </a>
              `
            )
            .join("")}
        </div>

        <div class="nav-section">
          <div class="navLabel">${NAV_GROUPS[1].title}</div>
          ${NAV_GROUPS[1].items
            .map(
              (item) => `
                <a class="navLink ${item.key === activeKey ? "active" : ""}" href="${item.href}">
                  <span class="nav-icon">${item.icon || "•"}</span>
                  <span>${item.label}</span>
                </a>
              `
            )
            .join("")}
        </div>

        <div class="nav-section">
          <div class="navLabel">ACCOUNT</div>
          <a class="navLink navLinkUtility" id="logoutLink" href="#">
            <span class="nav-icon">◌</span>
            <span>Log Out</span>
          </a>
        </div>
      </aside>

      <div class="contentArea">
  `;
}

function attachLogoutHandler() {
  const logoutLink = document.getElementById("logoutLink");
  if (!logoutLink) return;

  logoutLink.addEventListener("click", async (event) => {
    event.preventDefault();
    await api.post("/api/auth/logout");
    window.location.href = "/login.html";
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}
