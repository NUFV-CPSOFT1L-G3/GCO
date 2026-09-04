/**
 * Administrator Analytics, Monitoring, and Reporting Logic (Admin Screen 1 & 2)
 */

(async () => {
  const user = await requireAuth("admin");
  if (!user) return;

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1; // 1-12
  let filterAllTime = false;
  let statsData = null;
  let statusFilter = "all";
  let searchQuery = "";

  async function fetchStats() {
    let url = "/api/admin-stats";
    if (!filterAllTime) {
      url += `?month=${currentMonth}&year=${currentYear}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load statistics.");
      statsData = await res.json();
    } catch (err) {
      console.error(err);
      statsData = {
        summary: { total: 0, completed: 0, cancelled: 0, noShow: 0, confirmed: 0, averageRating: 0 },
        categories: {},
        courses: {},
        counselors: {},
        recentFeedback: [],
        appointments: [],
      };
    }
  }

  function getMonthName(m) {
    const d = new Date(2026, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long" });
  }

  function renderAdmin() {
    const summary = statsData.summary || {};
    const categories = statsData.categories || {};
    const courses = statsData.courses || {};
    const counselors = statsData.counselors || {};
    const feedbackList = statsData.recentFeedback || [];
    const appointments = statsData.appointments || [];

    // Filter appointments for monitoring table
    const filteredAppointments = appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (a.studentName || "").toLowerCase().includes(q);
        const matchId = (a.studentId || "").toLowerCase().includes(q);
        const matchConf = (a.confirmationNumber || "").toLowerCase().includes(q);
        const matchCounselor = (a.counselorName || "").toLowerCase().includes(q);
        return matchName || matchId || matchConf || matchCounselor;
      }
      return true;
    });

    // Find max category count for progress bar scaling
    const maxCatVal = Math.max(1, ...Object.values(categories));
    const maxCourseVal = Math.max(1, ...Object.values(courses));

    document.getElementById("app").innerHTML = `
      ${renderNav("admin", user)}
      <div class="main">
        <div class="admin-top-toolbar">
          <div>
            <h1 class="pagetitle">GCO Administrative Overview</h1>
            <p class="pagesub">Comprehensive consultation metrics, category trends, program analytics, and appointment records.</p>
          </div>

          <div class="admin-date-picker-wrap">
            <button type="button" class="btn btn-sm ${filterAllTime ? "btn-dark" : ""}" id="toggleAllTimeBtn">
              ${filterAllTime ? "Showing: All Time" : "View All Time"}
            </button>

            ${
              !filterAllTime
                ? `
                  <div class="cal-nav" style="margin: 0;">
                    <button type="button" class="btn btn-sm" id="prevMonthBtn">‹</button>
                    <span style="min-width: 140px; text-align: center;">${getMonthName(currentMonth)} ${currentYear}</span>
                    <button type="button" class="btn btn-sm" id="nextMonthBtn">›</button>
                  </div>
                `
                : ""
            }

            <button type="button" class="btn btn-dark btn-sm" id="openNewCounselorModalBtn">
              + Add Counselor
            </button>
            <button type="button" class="btn btn-sm" id="exportCsvBtn">
              📥 Export CSV
            </button>
          </div>
        </div>

        <!-- Stat Cards Row (Admin Screen 1) -->
        <div class="stat-row">
          <div class="card stat-card">
            <div class="num">${summary.total || 0}</div>
            <div class="label">Total Appointments</div>
          </div>
          <div class="card stat-card">
            <div class="num" style="color: #2e7d32;">${summary.completed || 0}</div>
            <div class="label">Completed Consultations</div>
          </div>
          <div class="card stat-card">
            <div class="num" style="color: #b3261e;">${summary.cancelled || 0}</div>
            <div class="label">Cancelled Sessions</div>
          </div>
          <div class="card stat-card">
            <div class="num" style="color: #e65100;">${summary.noShow || 0}</div>
            <div class="label">No-Show Records</div>
          </div>
          <div class="card stat-card">
            <div class="num" style="color: #d2a72e;">${summary.averageRating > 0 ? summary.averageRating : "—"} ★</div>
            <div class="label">Average Student Rating</div>
          </div>
        </div>

        <!-- 2-Column Analytics Section -->
        <div class="dash-cols" style="margin-bottom: 28px;">
          <!-- Left Column: Consultation Categories & College/Course-based Analytics -->
          <div class="dash-col">
            <!-- Categories Card -->
            <div class="card" style="padding: 24px; margin-bottom: 24px;">
              <div class="section-title">
                <span>Consultation Categories Frequency</span>
              </div>
              <p class="field-hint" style="margin-bottom: 16px;">Distribution of student counseling reasons to identify common concerns:</p>
              
              <div class="category-bars-list">
                ${
                  !Object.keys(categories).length
                    ? `<div class="empty-note">No consultation category data recorded for this period.</div>`
                    : Object.entries(categories)
                        .sort((a, b) => b[1] - a[1])
                        .map(
                          ([cat, count]) => `
                          <div class="cat-bar-row">
                            <div class="cat-bar-label">
                              <span>${escapeHtml(cat)}</span>
                              <strong>${count}</strong>
                            </div>
                            <div class="cat-bar-track">
                              <div class="cat-bar-fill" style="width: ${Math.round((count / maxCatVal) * 100)}%;"></div>
                            </div>
                          </div>
                        `
                        )
                        .join("")
                }
              </div>
            </div>

            <!-- Program Analytics Card -->
            <div class="card" style="padding: 24px;">
              <div class="section-title">
                <span>College / Program-Based Analytics</span>
              </div>
              <p class="field-hint" style="margin-bottom: 16px;">Counseling request distribution by academic program:</p>

              <div class="category-bars-list">
                ${
                  !Object.keys(courses).length
                    ? `<div class="empty-note">No program data recorded for this period.</div>`
                    : Object.entries(courses)
                        .sort((a, b) => b[1] - a[1])
                        .map(
                          ([course, count]) => `
                          <div class="cat-bar-row">
                            <div class="cat-bar-label">
                              <span>${escapeHtml(course)}</span>
                              <strong>${count}</strong>
                            </div>
                            <div class="cat-bar-track">
                              <div class="cat-bar-fill" style="width: ${Math.round((count / maxCourseVal) * 100)}%; background: #5c6bc0;"></div>
                            </div>
                          </div>
                        `
                        )
                        .join("")
                }
              </div>
            </div>
          </div>

          <!-- Right Column: Counselor Records & Recent Student Feedback -->
          <div class="dash-col">
            <!-- Counselor Consultation Records -->
            <div class="card" style="padding: 24px; margin-bottom: 24px;">
              <div class="section-title">
                <span>Counselor Consultation Records</span>
              </div>
              <div class="counselor-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Guidance Counselor</th>
                      <th>Total</th>
                      <th>Completed</th>
                      <th>No-Show</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      !Object.keys(counselors).length
                        ? `<tr><td colspan="4" class="empty-note">No counselor records found.</td></tr>`
                        : Object.entries(counselors)
                            .map(
                              ([cName, cStat]) => `
                              <tr>
                                <td><strong>${escapeHtml(cName)}</strong></td>
                                <td>${cStat.total}</td>
                                <td><span style="color:#2e7d32; font-weight:600;">${cStat.completed}</span></td>
                                <td><span style="color:#e65100;">${cStat.noShow}</span></td>
                              </tr>
                            `
                            )
                            .join("")
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Student Satisfaction & Recent Feedback -->
            <div class="card" style="padding: 24px;">
              <div class="section-title">
                <span>Recent Student Feedback (${summary.feedbackCount || 0} reviews)</span>
              </div>
              <div class="feedback-list-box">
                ${
                  !feedbackList.length
                    ? `<div class="empty-note">No student feedback entries submitted yet.</div>`
                    : feedbackList
                        .map(
                          (fb) => `
                          <div class="feedback-entry-row">
                            <div class="fb-stars">${"★".repeat(fb.rating || 5)}${"☆".repeat(5 - (fb.rating || 5))}</div>
                            <div class="fb-comment">"${escapeHtml(fb.comments || "Great consultation.")}"</div>
                            <div class="fb-student-tag">
                              Counselor: <strong>${escapeHtml(fb.counselorName || "")}</strong> · Student: ${escapeHtml(fb.studentName || "Anonymous")} (${escapeHtml(fb.course || "")})
                              ${Array.isArray(fb.appreciated) && fb.appreciated.length ? `<br><span class="fb-appreciated">Appreciated: ${escapeHtml(fb.appreciated.join(", "))}</span>` : ""}
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

        <!-- Appointment Monitoring Section (Admin Screen 2) -->
        <div class="card" style="padding: 24px;">
          <div class="section-title">
            <span>Appointment Monitoring & Records</span>
            <span class="see-all">Total Records: ${filteredAppointments.length}</span>
          </div>

          <div class="filter-controls-row">
            <input type="text" class="field-input" id="searchApptInput" placeholder="Search student name, ID, confirmation #..." value="${escapeHtml(searchQuery)}" style="max-width: 320px;" />

            <div class="status-filter-pills">
              ${["all", "confirmed", "completed", "no-show", "cancelled"]
                .map(
                  (st) => `
                  <button type="button" class="btn btn-sm ${statusFilter === st ? "btn-dark" : ""}" data-status-filter="${st}">
                    ${st.toUpperCase()}
                  </button>
                `
                )
                .join("")}
            </div>
          </div>

          <div class="table-responsive" style="margin-top: 16px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Confirmation #</th>
                  <th>Student Name</th>
                  <th>Student ID</th>
                  <th>Course / Program</th>
                  <th>Guidance Counselor</th>
                  <th>Date & Time</th>
                  <th>Reason(s)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${
                  !filteredAppointments.length
                    ? `<tr><td colspan="8" class="empty-note" style="text-align:center;">No matching appointment records found.</td></tr>`
                    : filteredAppointments
                        .map((a) => {
                          const badgeClass =
                            a.status === "completed"
                              ? "badge-completed"
                              : a.status === "no-show"
                              ? "badge-noshow"
                              : a.status === "cancelled"
                              ? "badge-cancelled"
                              : "badge-upcoming";

                          return `
                            <tr>
                              <td><strong class="conf-tag-cell">${escapeHtml(a.confirmationNumber || a.id)}</strong></td>
                              <td><strong>${escapeHtml(a.studentName)}</strong></td>
                              <td><code>${escapeHtml(a.studentId)}</code></td>
                              <td>${escapeHtml(a.course || "")}</td>
                              <td>${escapeHtml(a.counselorName)}</td>
                              <td>${escapeHtml(a.date)}<br><small style="color:var(--text-secondary);">${escapeHtml(a.startTime)} - ${escapeHtml(a.endTime || "")}</small></td>
                              <td>${escapeHtml(Array.isArray(a.categories) ? a.categories.join(", ") : a.categories || "")}</td>
                              <td>
                                <span class="status-badge ${badgeClass}">${escapeHtml(a.status)}</span>
                                ${a.cancellationReason ? `<br><small style="color:var(--danger); font-size:10px;">${escapeHtml(a.cancellationReason)}</small>` : ""}
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    `;

    attachNavHandlers();
    attachAdminEvents();
  }

  function attachAdminEvents() {
    // Month navigation
    const prevBtn = document.getElementById("prevMonthBtn");
    const nextBtn = document.getElementById("nextMonthBtn");
    const allTimeBtn = document.getElementById("toggleAllTimeBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", async () => {
        currentMonth--;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear--;
        }
        await fetchStats();
        renderAdmin();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
        await fetchStats();
        renderAdmin();
      });
    }

    if (allTimeBtn) {
      allTimeBtn.addEventListener("click", async () => {
        filterAllTime = !filterAllTime;
        await fetchStats();
        renderAdmin();
      });
    }

    // Status Filter pills
    document.querySelectorAll("[data-status-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        statusFilter = btn.dataset.statusFilter;
        renderAdmin();
      });
    });

    // Search query
    const searchInput = document.getElementById("searchApptInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim();
        renderAdmin();
      });
    }

    // Export CSV
    const exportBtn = document.getElementById("exportCsvBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        exportAppointmentsToCSV(statsData.appointments || []);
      });
    }

    // New Counselor Modal
    const modal = document.getElementById("newCounselorModal");
    const openBtn = document.getElementById("openNewCounselorModalBtn");
    const closeBtn = document.getElementById("closeNewCModalBtn");
    const form = document.getElementById("newCounselorForm");
    const errorBox = document.getElementById("newCError");
    const submitBtn = document.getElementById("submitNewCBtn");

    if (openBtn && modal) {
      openBtn.addEventListener("click", () => {
        errorBox.textContent = "";
        form.reset();
        modal.style.display = "flex";
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox.textContent = "";

        const name = document.getElementById("newCName").value.trim();
        const title = document.getElementById("newCTitle").value.trim();
        const credentials = document.getElementById("newCCredentials").value.trim();
        const email = document.getElementById("newCEmail").value.trim();
        const password = document.getElementById("newCPassword").value;

        submitBtn.disabled = true;
        submitBtn.textContent = "Creating...";

        try {
          const res = await fetch("/api/admin-counselors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, title, credentials, email, password }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to create counselor.");

          modal.style.display = "none";
          alert(`Counselor account for ${name} created successfully.`);
          await fetchStats();
          renderAdmin();
        } catch (err) {
          errorBox.textContent = err.message;
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Create Account";
        }
      });
    }
  }

  function exportAppointmentsToCSV(appointments) {
    if (!appointments.length) {
      alert("No appointments available to export.");
      return;
    }

    const headers = [
      "Confirmation Number",
      "Student Name",
      "Student ID",
      "Student Email",
      "Course",
      "Guidance Counselor",
      "Date",
      "Start Time",
      "End Time",
      "Categories",
      "Status",
      "Cancellation Reason",
      "Cancellation Remarks",
      "Created At",
    ];

    const rows = appointments.map((a) => [
      `"${a.confirmationNumber || a.id || ""}"`,
      `"${(a.studentName || "").replace(/"/g, '""')}"`,
      `"${a.studentId || ""}"`,
      `"${a.studentEmail || ""}"`,
      `"${(a.course || "").replace(/"/g, '""')}"`,
      `"${(a.counselorName || "").replace(/"/g, '""')}"`,
      `"${a.date || ""}"`,
      `"${a.startTime || ""}"`,
      `"${a.endTime || ""}"`,
      `"${(Array.isArray(a.categories) ? a.categories.join("; ") : a.categories || "").replace(/"/g, '""')}"`,
      `"${a.status || ""}"`,
      `"${(a.cancellationReason || "").replace(/"/g, '""')}"`,
      `"${(a.cancellationRemarks || "").replace(/"/g, '""')}"`,
      `"${a.createdAt || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GCOunsel_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  await fetchStats();
  renderAdmin();
})();
