function parseISODate(dateString) {
  return new Date(dateString + "T00:00:00");
}

function toISODate(dateObject) {
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, "0");
  const day = String(dateObject.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDate(dateString, dayOffset) {
  const date = parseISODate(dateString);
  date.setDate(date.getDate() + dayOffset);
  return toISODate(date);
}

function formatDayHeader(isoDate) {
  const date = parseISODate(isoDate);
  return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function formatRangeLabel(weekStart, weekEnd) {
  const startDate = parseISODate(weekStart);
  const endDate = parseISODate(weekEnd);
  const startLabel = startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const endLabel = endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function formatHourLabel(hourString) {
  const hour = parseInt(hourString.split(":")[0], 10);
  const period = hour >= 12 ? "PM" : "AM";
  const hourInTwelveHourFormat = hour % 12 === 0 ? 12 : hour % 12;
  return `${hourInTwelveHourFormat}:00 ${period}`;
}

function formatDateLabel(isoDate) {
  const date = parseISODate(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildGrid(scheduleData) {
  const { weekDays, hours, appointments, blockedDates = [] } = scheduleData;

  const appointmentsByCell = {};
  appointments.forEach((appointment) => {
    const hour = `${appointment.startTime.split(":")[0]}:00`;
    const cellKey = `${hour}|${appointment.date}`;
    (appointmentsByCell[cellKey] = appointmentsByCell[cellKey] || []).push(appointment);
  });

  const blockedReasonByDate = {};
  blockedDates.forEach((blockedDate) => {
    blockedReasonByDate[blockedDate.date] = blockedDate.reason || "Blocked";
  });

  let gridCells = "";
  const firstHour = hours[0];

  hours.forEach((hour) => {
    gridCells += `<div class="time-cell">${formatHourLabel(hour)}</div>`;
    weekDays.forEach((day) => {
      const items = appointmentsByCell[`${hour}|${day}`] || [];
      const dayNumber = new Date(day + "T00:00:00").getDay();
      const isSunday = dayNumber === 0;
      const blockedReason = blockedReasonByDate[day] || (isSunday ? "Sunday closed" : "");
      const isBlockedDayMarker = Boolean(blockedReason) && hour === firstHour && items.length === 0;

      if (blockedReason && hour !== firstHour) {
        gridCells += `<div class="day-cell"></div>`;
        return;
      }

      const renderedItems = items.length
        ? items.map(
            (appointment) => `
              <div class="slot-block ${appointment.status === "blocked" ? "blocked" : ""}" title="${escapeHtml(appointment.studentName)} · ${escapeHtml(appointment.sessionType)}">
                <div>${escapeHtml(appointment.studentName)}</div>
                <div class="sub">${escapeHtml(appointment.sessionType)}</div>
              </div>`
          )
        : isBlockedDayMarker
          ? [
              `
              <div class="slot-block blocked" title="${escapeHtml(blockedReason)}">
                <div>${isSunday ? "Closed" : "Unavailable"}</div>
                <div class="sub">${escapeHtml(blockedReason)}</div>
              </div>`,
            ]
          : [];

      gridCells += `<div class="day-cell">${renderedItems.join("")}</div>`;
    });
  });

  return `
    <div class="week-grid" style="grid-template-columns: 64px repeat(${weekDays.length}, 1fr);">
      <div class="head-cell"></div>
      ${weekDays.map((day) => `<div class="head-cell">${formatDayHeader(day)}</div>`).join("")}
      ${gridCells}
    </div>
  `;
}

(async () => {
  const counselor = await requireCounselor();
  if (!counselor) return;

  const searchParams = new URLSearchParams(window.location.search);
  let weekStart = searchParams.get("weekStart") || null;

  async function loadSchedule() {
    const url = weekStart ? `/api/schedule/week?weekStart=${weekStart}` : "/api/schedule/week";
    const scheduleData = await api.get(url);
    weekStart = scheduleData.weekStart;

    document.getElementById("app").innerHTML = `
      ${renderNav("schedule", counselor)}
      <div class="main">
        <h1 class="pagetitle">Weekly Schedule</h1>
        <p class="pagesub">Your booked and blocked time for the week.</p>

        <div class="cal-toolbar">
          <div class="cal-nav">
            <span class="btn" id="prevWeek">‹ Prev</span>
            <span>${formatRangeLabel(scheduleData.weekStart, scheduleData.weekEnd)}</span>
            <span class="btn" id="nextWeek">Next ›</span>
          </div>
        </div>

        ${buildGrid(scheduleData)}

        <div class="legend">
          <span><span class="dot" style="background:var(--surface-strong)"></span>Confirmed session</span>
          <span><span class="dot" style="background:var(--surface-muted); border:1px dashed #9c9c9c;"></span>Blocked / unavailable</span>
        </div>
      </div>
      </div>
    `;

    attachLogoutHandler();

    document.getElementById("prevWeek").addEventListener("click", () => {
      weekStart = addDaysToDate(weekStart, -7);
      updateUrl();
      loadSchedule();
    });

    document.getElementById("nextWeek").addEventListener("click", () => {
      weekStart = addDaysToDate(weekStart, 7);
      updateUrl();
      loadSchedule();
    });
  }

  function updateUrl() {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("weekStart", weekStart);
    window.history.replaceState({}, "", nextUrl);
  }

  loadSchedule();
})();
