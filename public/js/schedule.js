/**
 * Counselor Calendar & Daily Schedule Management (GCO Web Screen 2 / Mobile Screen 2)
 */

function formatTime12h(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

(async () => {
  const user = await requireAuth("counselor");
  if (!user) return;

  let counselorProfile = user;
  let currentDate = new Date();
  let selectedDate = new Date(); // Date being viewed

  // Fetch counselor profile with weekly hours and blocked dates
  async function loadProfile() {
    if (window.firestoreDb && user.uid) {
      try {
        const doc = await window.firestoreDb.collection("counselors").doc(user.uid).get();
        if (doc.exists) {
          counselorProfile = { uid: user.uid, ...doc.data() };
        }
      } catch (e) {
        console.warn("Profile load error:", e);
      }
    }
  }

  // Fetch all appointments for the current month
  async function fetchMonthAppointments(year, month) {
    const appointments = [];
    const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
    const counselorId = user.uid || user.id;

    if (window.firestoreDb && counselorId) {
      try {
        const query = await window.firestoreDb
          .collection("appointments")
          .where("counselorId", "==", counselorId)
          .where("date", ">=", startStr)
          .where("date", "<=", endStr)
          .get();
        query.forEach((doc) => {
          appointments.push({ id: doc.id, ...doc.data() });
        });
        return appointments;
      } catch (e) {
        console.warn("Direct Firestore appointment query notice:", e.message);
      }
    }

    try {
      const res = await fetch("/api/admin-stats");
      if (res.ok) {
        const data = await res.json();
        appointments.push(
          ...(data.appointments || []).filter(
            (appointment) =>
              (appointment.counselorId === counselorId || appointment.counselorName === user.name) &&
              appointment.date >= startStr &&
              appointment.date <= endStr
          )
        );
      }
    } catch (e) {
      console.error(e);
    }

    return appointments;
  }

  async function renderScreen() {
    await loadProfile();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString("en-US", { month: "long" });

    const appointments = await fetchMonthAppointments(year, month);
    const blockedDates = counselorProfile.blockedDates || [];

    // Appts count map by date
    const apptsByDate = {};
    appointments.forEach((a) => {
      apptsByDate[a.date] = (apptsByDate[a.date] || 0) + 1;
    });

    const blockedMap = {};
    blockedDates.forEach((b) => {
      blockedMap[b.date] = b.reason || "Out of Office";
    });

    // Calendar grid calculation
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const selectedIsoStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

    document.getElementById("app").innerHTML = `
      ${renderNav("schedule", counselorProfile)}
      <div class="main">
        <h1 class="pagetitle">Calendar & Schedule Management</h1>
        <p class="pagesub">Select a date to view and manage appointments, available slots, and out-of-office periods.</p>

        <div class="counselor-calendar-container card">
          <!-- Left: Calendar Widget (GCO Web Screen 2) -->
          <div class="cal-picker-box">
            <div class="cal-month-nav">
              <button type="button" class="btn btn-sm" id="calPrevMonth">‹</button>
              <span class="cal-current-month">${monthName} ${year}</span>
              <button type="button" class="btn btn-sm" id="calNextMonth">›</button>
            </div>

            <div class="cal-days-header">
              <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
            </div>

            <div class="cal-days-grid" id="calDaysGrid">
              ${renderCalendarDays(firstDayIndex, daysInMonth, year, month, selectedIsoStr, apptsByDate, blockedMap)}
            </div>

            <div class="cal-legend-bar">
              <span><span class="dot dot-appt"></span> Has Appointment</span>
              <span><span class="dot dot-blocked"></span> Out of Office</span>
            </div>

            <div style="margin-top: 20px;">
              <a href="/availability.html" class="btn btn-dark btn-block">⚙ Manage Recurring Availability</a>
            </div>
          </div>

          <!-- Right: Daily Schedule & Slot Inspector -->
          <div class="cal-daily-view">
            <div class="daily-header">
              <h2 class="daily-title">Selected Date: ${selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</h2>
              ${
                blockedMap[selectedIsoStr]
                  ? `<span class="badge-pill badge-danger">Out of Office: ${escapeHtml(blockedMap[selectedIsoStr])}</span>`
                  : `<span class="badge-pill badge-college">Regular Working Day</span>`
              }
            </div>

            <div class="daily-slots-list" id="dailySlotsList">
              ${renderDailySlots(selectedIsoStr, selectedDate, counselorProfile, appointments, blockedMap)}
            </div>
          </div>
        </div>
      </div>
      </div>
    `;

    attachNavHandlers();
    attachCalendarEvents(year, month);
  }

  function renderCalendarDays(firstDayIndex, daysInMonth, year, month, selectedIsoStr, apptsByDate, blockedMap) {
    let cells = "";

    // Empty spaces before first day of month
    for (let i = 0; i < firstDayIndex; i++) {
      cells += `<div class="cal-day-cell empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = iso === selectedIsoStr;
      const isToday = iso === new Date().toISOString().slice(0, 10);
      const hasAppts = Boolean(apptsByDate[iso]);
      const isBlocked = Boolean(blockedMap[iso]);

      cells += `
        <div class="cal-day-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${isBlocked ? "blocked" : ""}" data-iso="${iso}">
          <span class="day-number">${day}</span>
          <div class="day-indicators">
            ${hasAppts ? `<span class="indicator-dot dot-appt" title="${apptsByDate[iso]} appointment(s)"></span>` : ""}
            ${isBlocked ? `<span class="indicator-dot dot-blocked" title="Out of Office"></span>` : ""}
          </div>
        </div>
      `;
    }

    return cells;
  }

  function renderDailySlots(isoDate, dateObj, counselor, appointments, blockedMap) {
    const dayOfWeek = dateObj.getDay();
    const isSunday = dayOfWeek === 0;
    const isBlocked = Boolean(blockedMap[isoDate]);
    const dayAppointments = appointments.filter((a) => a.date === isoDate && a.status !== "cancelled");

    if (isSunday) {
      return `<div class="empty-note">The Guidance Counseling Office is closed on Sundays.</div>${renderAdditionalAppointmentRows(dayAppointments)}`;
    }

    if (isBlocked) {
      return `
        <div class="alert-box-static alert-danger" style="margin-bottom: 16px;">
          <strong>Out of Office / Blocked Period</strong><br>
          Reason: ${escapeHtml(blockedMap[isoDate])}
        </div>
        <p class="field-hint">Students cannot schedule appointments during this date.</p>
        ${renderAdditionalAppointmentRows(dayAppointments)}
      `;
    }

    const weeklyHours = counselor.weeklyHours || [];
    const dayConfig = weeklyHours.find((d) => d.dayOfWeek === dayOfWeek);

    if (!dayConfig || !dayConfig.isActive) {
      return `<div class="empty-note">You are not scheduled for office hours on this day.</div>${renderAdditionalAppointmentRows(dayAppointments)}`;
    }

    // Generate slots
    const duration = counselor.defaultDurationMinutes || 30;
    const [startH, startM] = (dayConfig.startTime || "08:00").split(":").map(Number);
    const [endH, endM] = (dayConfig.endTime || "17:00").split(":").map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    const apptMap = {};
    dayAppointments.forEach((a) => {
      apptMap[a.startTime] = a;
    });

    const rows = [];
    const displayedAppointmentIds = new Set();
    for (let m = startTotal; m + duration <= endTotal; m += duration) {
      const hStr = String(Math.floor(m / 60)).padStart(2, "0");
      const mStr = String(m % 60).padStart(2, "0");
      const time24 = `${hStr}:${mStr}`;

      const endSlotM = m + duration;
      const endHStr = String(Math.floor(endSlotM / 60)).padStart(2, "0");
      const endMStr = String(endSlotM % 60).padStart(2, "0");
      const endTime24 = `${endHStr}:${endMStr}`;

      const appt = apptMap[time24];

      if (appt) {
        displayedAppointmentIds.add(appt.id);
        const statusLabel = appt.status === "completed" ? "Completed" : appt.status === "no-show" ? "No-Show" : appt.status === "cancelled" ? "Cancelled" : "Confirmed";
        const isActionable = appt.status === "confirmed";
        const apptEnd = new Date(`${appt.date}T${appt.endTime || appt.startTime}:00`);
        const canMarkNoShow = !isNaN(apptEnd.getTime()) && apptEnd.getTime() <= Date.now();

        rows.push(`
          <div class="daily-slot-row slot-booked">
            <div class="slot-time-lbl">${formatTime12h(time24)} – ${formatTime12h(endTime24)}</div>
            <div class="slot-status-lbl">
              <span class="status-badge badge-appointment">${statusLabel}</span>
              <strong class="slot-student-title">${escapeHtml(appt.studentName)}</strong>
              <span class="slot-meta-desc">(${escapeHtml(appt.course || "")} · ${escapeHtml(Array.isArray(appt.categories) ? appt.categories.join(", ") : appt.categories || "")})</span>
              ${isActionable ? `
                <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                  <button type="button" class="btn btn-sm btn-mark-complete-schedule" data-id="${appt.id}" title="Mark Complete">✓ Complete</button>
                  ${canMarkNoShow ? `<button type="button" class="btn btn-sm btn-mark-noshow-schedule" data-id="${appt.id}" title="Mark No-Show">✕ No-Show</button>` : ""}
                </div>
              ` : ""}
            </div>
          </div>
        `);
      } else {
        rows.push(`
          <div class="daily-slot-row slot-open">
            <div class="slot-time-lbl">${formatTime12h(time24)} – ${formatTime12h(endTime24)}</div>
            <div class="slot-status-lbl">
              <span class="status-badge badge-available">Available</span>
              <span class="slot-meta-desc">Open for student booking</span>
            </div>
          </div>
        `);
      }
    }

    const unplacedAppointments = dayAppointments.filter((appointment) => !displayedAppointmentIds.has(appointment.id));
    return `${rows.join("")}${renderAdditionalAppointmentRows(unplacedAppointments)}`;
  }

  function renderAdditionalAppointmentRows(appointments) {
    return appointments
      .map((appt) => {
        const statusLabel =
          appt.status === "completed"
            ? "Completed"
            : appt.status === "no-show"
            ? "No-Show"
            : appt.status === "cancelled"
            ? "Cancelled"
            : "Confirmed";
        const isActionable = appt.status === "confirmed";
        const apptEnd = new Date(`${appt.date}T${appt.endTime || appt.startTime}:00`);
        const canMarkNoShow = !isNaN(apptEnd.getTime()) && apptEnd.getTime() <= Date.now();

        return `
          <div class="daily-slot-row slot-booked">
            <div class="slot-time-lbl">${formatTime12h(appt.startTime)}${appt.endTime ? ` – ${formatTime12h(appt.endTime)}` : ""}</div>
            <div class="slot-status-lbl">
              <span class="status-badge badge-appointment">${statusLabel}</span>
              <strong class="slot-student-title">${escapeHtml(appt.studentName)}</strong>
              <span class="slot-meta-desc">(${escapeHtml(appt.course || "")} · ${escapeHtml(Array.isArray(appt.categories) ? appt.categories.join(", ") : appt.categories || "")})</span>
              ${isActionable ? `
                <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                  <button type="button" class="btn btn-sm btn-mark-complete-schedule" data-id="${appt.id}" title="Mark Complete">✓ Complete</button>
                  ${canMarkNoShow ? `<button type="button" class="btn btn-sm btn-mark-noshow-schedule" data-id="${appt.id}" title="Mark No-Show">✕ No-Show</button>` : ""}
                </div>
              ` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function attachCalendarEvents(year, month) {
    document.getElementById("calPrevMonth").addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderScreen();
    });

    document.getElementById("calNextMonth").addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderScreen();
    });

    document.querySelectorAll(".cal-day-cell:not(.empty)").forEach((cell) => {
      cell.addEventListener("click", () => {
        const iso = cell.dataset.iso;
        selectedDate = new Date(iso + "T00:00:00");
        renderScreen();
      });
    });

    document.querySelectorAll(".btn-mark-complete-schedule").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Mark this consultation session as Completed? A post-consultation satisfaction survey will be sent to the student.")) {
          return;
        }

        btn.disabled = true;
        btn.textContent = "...";

        try {
          const res = await fetch("/api/update-appointment-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: btn.dataset.id, status: "completed" }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to update appointment.");
          }

          renderScreen();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "✓ Complete";
        }
      });
    });

    document.querySelectorAll(".btn-mark-noshow-schedule").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Mark this appointment as No-Show?")) {
          return;
        }

        btn.disabled = true;
        btn.textContent = "...";

        try {
          const res = await fetch("/api/update-appointment-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: btn.dataset.id, status: "no-show" }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to update appointment.");
          }

          renderScreen();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "✕ No-Show";
        }
      });
    });
  }

  renderScreen();
})();
