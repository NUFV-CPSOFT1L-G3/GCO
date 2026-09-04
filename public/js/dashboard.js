const STATIC_PENDING_REQUESTS = [
  { name: "Sam Ilagan", tag: "SHS · Grade 10", type: "Academic Advising", requestDate: "Requested Aug 12, 2:00 PM" },
  { name: "Nadia Guerrero", tag: "College · BSCPE-IR", type: "Personal Counseling", requestDate: "Requested Aug 13, 10:00 AM" },
  { name: "Paolo Aquino", tag: "SHS · Grade 12", type: "Career Counseling", requestDate: "Requested Aug 12, 3:30 PM" },
];

function formatTimeFromHoursMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hourInTwelveHourFormat = hours % 12 === 0 ? 12 : hours % 12;
  return `${hourInTwelveHourFormat}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTodayLabel(isoDate) {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function renderTodaysSchedule(items) {
  if (!items.length) {
    return `<div class="empty-note">No sessions scheduled for today.</div>`;
  }

  return items
    .map(
      (appointment) => `
        <div class="appt-row">
          <div class="appt-time">${formatTimeFromHoursMinutes(appointment.startTime)}</div>
          <div class="appt-info">
            <div class="name">${escapeHtml(appointment.name)}</div>
            <div class="meta">${escapeHtml(appointment.type)} ${appointment.tag ? `· <span class="badge-pill">${escapeHtml(appointment.tag)}</span>` : ""}</div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderPendingRequests(items) {
  return items
    .map(
      (request) => `
        <div class="req-row">
          <div style="flex:1">
            <div class="name">${escapeHtml(request.name)} <span class="badge-pill">${escapeHtml(request.tag)}</span></div>
            <div class="meta">${escapeHtml(request.type)} · ${escapeHtml(request.requestDate)}</div>
          </div>
          <div class="req-actions">
            <div class="btn btn-dark" disabled title="Requests aren't built yet">Confirm</div>
            <div class="btn" disabled title="Requests aren't built yet">Decline</div>
          </div>
        </div>
      `
    )
    .join("");
}

(async () => {
  const counselor = await requireCounselor();
  if (!counselor) return;

  const dashboardData = await api.get("/api/dashboard");

  document.getElementById("app").innerHTML = `
    ${renderNav("dashboard", counselor)}
    <div class="main">
      <h1 class="pagetitle">Good day, ${escapeHtml(counselor.name)}</h1>
      <p class="pagesub">${formatTodayLabel(dashboardData.todayISO)} · Here's what's on your plate today.</p>

      <div class="stat-row">
        <div class="card stat-card"><div class="num">${dashboardData.stats.sessionsToday}</div><div class="label">Sessions Today</div></div>
        <div class="card stat-card"><div class="num">${dashboardData.stats.pendingRequests}</div><div class="label">Pending Requests</div></div>
        <div class="card stat-card"><div class="num">${dashboardData.stats.sessionsThisWeek}</div><div class="label">This Week</div></div>
      </div>

      <div class="dash-cols">
        <div class="dash-col">
          <div class="section-title"><span>Today's Schedule</span><a class="see-all" href="/schedule.html">View full calendar →</a></div>
          ${renderTodaysSchedule(dashboardData.todaysSchedule)}
        </div>
        <div class="dash-col">
          <div class="section-title"><span>Pending Requests</span><span class="see-all">See all (${STATIC_PENDING_REQUESTS.length}) →</span></div>
          ${renderPendingRequests(STATIC_PENDING_REQUESTS)}
        </div>
      </div>
    </div>
    </div>
  `;

  attachLogoutHandler();
})();
