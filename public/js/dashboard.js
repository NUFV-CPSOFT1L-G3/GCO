/**
 * Counselor Dashboard Logic (GCO Web Screen 1 / Mobile Screen 1 & 3)
 */

function formatTime12h(time24) {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

(async () => {
  const user = await requireAuth("counselor");
  if (!user) return;

  let currentProfile = user;
  const todayISO = getTodayISO();

  // Load latest counselor profile from Firestore if available
  async function fetchProfile() {
    if (window.firestoreDb && user.uid) {
      try {
        const doc = await window.firestoreDb.collection("counselors").doc(user.uid).get();
        if (doc.exists) {
          currentProfile = { uid: user.uid, ...doc.data() };
        }
      } catch (err) {
        console.warn("Could not reload profile from Firestore:", err.message);
      }
    }
  }

  // Fetch today's appointments for this counselor
  async function fetchTodayAppointments() {
    const appointments = [];
    if (window.firestoreDb) {
      try {
        const query = await window.firestoreDb
          .collection("appointments")
          .where("counselorId", "==", user.uid || user.id)
          .where("date", "==", todayISO)
          .get();

        query.forEach((doc) => {
          appointments.push({ id: doc.id, ...doc.data() });
        });
      } catch (err) {
        console.warn("Direct Firestore appt query notice:", err.message);
      }
    }

    // Fallback: fetch from admin-stats API if direct query was blocked or offline
    if (!appointments.length) {
      try {
        const res = await fetch("/api/admin-stats");
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.appointments || []).filter(
            (a) => (a.counselorId === (user.uid || user.id) || a.counselorName === user.name) && a.date === todayISO
          );
          appointments.push(...filtered);
        }
      } catch (e) {
        console.error(e);
      }
    }

    appointments.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    return appointments;
  }

  // Fetch recent feedback for this counselor
  async function fetchRecentFeedback() {
    const feedbackList = [];
    if (window.firestoreDb) {
      try {
        const query = await window.firestoreDb
          .collection("feedback")
          .where("counselorId", "==", user.uid || user.id)
          .limit(5)
          .get();

        query.forEach((doc) => {
          feedbackList.push({ id: doc.id, ...doc.data() });
        });
      } catch (err) {
        console.warn("Direct feedback query notice:", err.message);
      }
    }

    if (!feedbackList.length) {
      try {
        const res = await fetch("/api/admin-stats");
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.recentFeedback || []).filter(
            (f) => f.counselorId === (user.uid || user.id) || f.counselorName === user.name
          );
          feedbackList.push(...filtered.slice(0, 5));
        }
      } catch (e) {
        console.error(e);
      }
    }

    return feedbackList;
  }

  async function renderDashboard() {
    await fetchProfile();
    const todaysSchedule = await fetchTodayAppointments();
    const recentFeedback = await fetchRecentFeedback();

    const preferredAreas = currentProfile.preferredAreas || [
      "Academic", "Career", "Personal", "Family", "Social", "Mental Wellness"
    ];

    document.getElementById("app").innerHTML = `
      ${renderNav("dashboard", currentProfile)}
      <div class="main">
        <h1 class="pagetitle">Guidance Counselor Portal</h1>
        <p class="pagesub">Today is ${formatDateDisplay(todayISO)} · Consultation Schedule and Activities</p>

        <div class="counselor-home-grid">
          <!-- Left Column: Counselor Profile Card (GCO Web Screen 1) -->
          <div class="card counselor-profile-card">
            <div class="counselor-profile-header">
              <div class="large-avatar">👤</div>
              <h2 class="counselor-name">${escapeHtml(currentProfile.name || currentProfile.displayName || "Counselor Name")}</h2>
              <div class="counselor-title">${escapeHtml(currentProfile.title || "Guidance Counselor")}</div>
              <div class="counselor-credentials">${escapeHtml(currentProfile.credentials || "MS, LPC, LMHC, RGC")}</div>
            </div>

            <div class="counselor-areas-box">
              <div class="area-box-title">Preferred Counseling Areas:</div>
              <div class="areas-pill-container">
                ${["Academic", "Career", "Personal", "Family", "Social", "Mental Wellness"]
                  .map(
                    (area) => `
                    <span class="area-tag ${preferredAreas.includes(area) ? "checked" : ""}">
                      ${preferredAreas.includes(area) ? "☑" : "☐"} ${escapeHtml(area)}
                    </span>
                  `
                  )
                  .join("")}
              </div>
            </div>

            <div class="counselor-metrics-row">
              <div class="metric-item">
                <span class="metric-num">${currentProfile.sessionsHandled || 0}</span>
                <span class="metric-lbl">Sessions Handled</span>
              </div>
              <div class="metric-item">
                <span class="metric-num">${currentProfile.sessionsCompleted || 0}</span>
                <span class="metric-lbl">Sessions Completed</span>
              </div>
            </div>

            <button type="button" class="btn btn-dark btn-block" id="editProfileBtn" style="margin-top: 20px;">
              Edit Profile
            </button>
          </div>

          <!-- Right Column: Today's Schedule & Yesterday's Feedback -->
          <div class="counselor-schedule-col">
            <!-- Today's Schedule Card -->
            <div class="card" style="padding: 24px; margin-bottom: 24px;">
              <div class="section-title">
                <span>Today's Schedule</span>
                <a href="/schedule.html" class="see-all">View Full Calendar →</a>
              </div>

              <div id="scheduleItemsContainer">
                ${
                  !todaysSchedule.length
                    ? `<div class="empty-note">No appointments scheduled for today.</div>`
                    : todaysSchedule
                        .map((appt) => {
                          const statusClass =
                            appt.status === "completed"
                              ? "badge-completed"
                              : appt.status === "no-show"
                              ? "badge-noshow"
                              : appt.status === "cancelled"
                              ? "badge-cancelled"
                              : "badge-upcoming";

                          const statusLabel =
                            appt.status === "completed"
                              ? "Completed"
                              : appt.status === "no-show"
                              ? "No-Show"
                              : appt.status === "cancelled"
                              ? "Cancelled"
                              : "Upcoming";

                          const isActionable = appt.status === "confirmed";

                          return `
                            <div class="appt-card-row">
                              <div class="appt-time-col">
                                <strong>${formatTime12h(appt.startTime)}</strong>
                                <span class="appt-end-time">${formatTime12h(appt.endTime)}</span>
                              </div>
                              <div class="appt-main-col">
                                <div class="appt-student-name">${escapeHtml(appt.studentName)}</div>
                                <div class="appt-student-meta">
                                  ${escapeHtml(appt.course || "")} · ${escapeHtml(Array.isArray(appt.categories) ? appt.categories.join(", ") : appt.categories || "")}
                                </div>
                                <div class="appt-conf-tag">Ref: ${escapeHtml(appt.confirmationNumber || appt.id)}</div>
                              </div>
                              <div class="appt-status-col">
                                <span class="status-badge ${statusClass}">${statusLabel}</span>
                                ${
                                  isActionable
                                    ? `
                                      <div class="appt-actions-dropdown">
                                        <button type="button" class="btn btn-sm btn-mark-complete" data-id="${appt.id}" title="Mark Consultation Completed">✓ Complete</button>
                                        <button type="button" class="btn btn-sm btn-mark-noshow" data-id="${appt.id}" title="Mark Student No-Show">✕ No-Show</button>
                                        <button type="button" class="btn btn-sm btn-cancel-appt" data-id="${appt.id}" data-name="${escapeHtml(appt.studentName)}" data-time="${formatTime12h(appt.startTime)}" title="Cancel Consultation">Cancel</button>
                                      </div>
                                    `
                                    : ""
                                }
                              </div>
                            </div>
                          `;
                        })
                        .join("")
                }
              </div>
            </div>

            <!-- Yesterday's / Recent Feedback Card -->
            <div class="card" style="padding: 24px;">
              <div class="section-title">
                <span>Recent Student Feedback</span>
              </div>

              <div id="feedbackItemsContainer">
                ${
                  !recentFeedback.length
                    ? `<div class="empty-note">No feedback submissions received yet. Completed sessions will appear here.</div>`
                    : recentFeedback
                        .map(
                          (f) => `
                          <div class="feedback-entry-row">
                            <div class="fb-stars">${"★".repeat(f.rating || 5)}${"☆".repeat(5 - (f.rating || 5))}</div>
                            <div class="fb-comment">"${escapeHtml(f.comments || "Thank you for the consultation.")}"</div>
                            <div class="fb-student-tag">
                              ${escapeHtml(f.studentName || "Student")} · ${escapeHtml(f.course || "")}
                              ${Array.isArray(f.appreciated) && f.appreciated.length ? ` · <span class="fb-appreciated">${escapeHtml(f.appreciated.join(", "))}</span>` : ""}
                            </div>
                          </div>
                        `
                        )
                        .join("")
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    `;

    attachNavHandlers();
    attachDashboardActionHandlers();
  }

  function attachDashboardActionHandlers() {
    // 1. Mark Completed
    document.querySelectorAll(".btn-mark-complete").forEach((btn) => {
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

          renderDashboard();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "✓ Complete";
        }
      });
    });

    // 2. Mark No-Show
    document.querySelectorAll(".btn-mark-noshow").forEach((btn) => {
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

          renderDashboard();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "✕ No-Show";
        }
      });
    });

    // 3. Cancel Appointment Modal
    const cancelModal = document.getElementById("cancelModal");
    const cancelForm = document.getElementById("cancelForm");
    const cancelApptId = document.getElementById("cancelApptId");
    const cancelApptDetails = document.getElementById("cancelApptDetails");
    const cancelReason = document.getElementById("cancelReason");
    const cancelRemarks = document.getElementById("cancelRemarks");
    const cancelError = document.getElementById("cancelError");
    const closeCancelModalBtn = document.getElementById("closeCancelModalBtn");

    document.querySelectorAll(".btn-cancel-appt").forEach((btn) => {
      btn.addEventListener("click", () => {
        cancelApptId.value = btn.dataset.id;
        cancelApptDetails.textContent = `Cancelling appointment for ${btn.dataset.name} at ${btn.dataset.time}. Please specify the cancellation reason:`;
        cancelReason.value = "";
        cancelRemarks.value = "";
        cancelError.textContent = "";
        cancelModal.style.display = "flex";
      });
    });

    closeCancelModalBtn.addEventListener("click", () => {
      cancelModal.style.display = "none";
    });

    cancelForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      cancelError.textContent = "";

      if (!cancelReason.value) {
        cancelError.textContent = "Please select a cancellation reason.";
        return;
      }

      const confirmBtn = document.getElementById("confirmCancelBtn");
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Cancelling...";

      try {
        const res = await fetch("/api/update-appointment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: cancelApptId.value,
            status: "cancelled",
            cancellationReason: cancelReason.value,
            cancellationRemarks: cancelRemarks.value,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to cancel appointment.");
        }

        cancelModal.style.display = "none";
        renderDashboard();
      } catch (err) {
        cancelError.textContent = err.message;
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Cancellation";
      }
    });

    // 4. Edit Profile Modal
    const profileModal = document.getElementById("profileModal");
    const profileForm = document.getElementById("profileForm");
    const editProfileBtn = document.getElementById("editProfileBtn");
    const closeProfileModalBtn = document.getElementById("closeProfileModalBtn");

    if (editProfileBtn) {
      editProfileBtn.addEventListener("click", () => {
        document.getElementById("profName").value = currentProfile.name || currentProfile.displayName || "";
        document.getElementById("profTitle").value = currentProfile.credentials || currentProfile.title || "";

        const areas = currentProfile.preferredAreas || [];
        document.querySelectorAll('input[name="profAreas"]').forEach((cb) => {
          cb.checked = areas.includes(cb.value);
        });

        profileModal.style.display = "flex";
      });
    }

    closeProfileModalBtn.addEventListener("click", () => {
      profileModal.style.display = "none";
    });

    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("profName").value.trim();
      const credentials = document.getElementById("profTitle").value.trim();
      const selectedAreas = Array.from(document.querySelectorAll('input[name="profAreas"]:checked')).map(
        (cb) => cb.value
      );

      if (window.firestoreDb && user.uid) {
        try {
          await window.firestoreDb.collection("counselors").doc(user.uid).update({
            name,
            credentials,
            preferredAreas: selectedAreas,
          });
        } catch (err) {
          console.warn("Could not write profile to Firestore:", err);
        }
      }

      currentProfile.name = name;
      currentProfile.credentials = credentials;
      currentProfile.preferredAreas = selectedAreas;

      profileModal.style.display = "none";
      renderDashboard();
    });
  }

  renderDashboard();
})();
