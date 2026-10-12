/**
 * Administrator Analytics, Monitoring, and Reporting Logic (Admin Screen 1 & 2)
 * Includes Guidance Counselor & Staff Accounts Management for System Scalability
 */

(async () => {
  const user = await requireAuth("admin");
  if (!user) return;

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1; // 1-12
  let filterAllTime = false;
  let statsData = null;
  let counselorsList = [];
  let statusFilter = "all";
  let searchQuery = "";

  async function fetchCounselors() {
    let list = [];

    // 1. Try reading from Netlify function API first (canonical serverless authority)
    try {
      const res = await fetch("/api/admin-counselors");
      if (res.ok) {
        list = await res.json();
      }
    } catch (e) {
      console.warn("API counselor read notice:", e);
    }

    // 2. Direct Firestore fallback if API not reachable
    if (!list.length && window.firestoreDb) {
      try {
        const snap = await window.firestoreDb.collection("counselors").get();
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn("Direct Firestore counselor read notice:", e);
      }
    }

    // 3. Fallback to locally registered accounts ONLY if server and Firestore have no accounts (offline demo mode)
    if (!list.length) {
      try {
        const localList = JSON.parse(localStorage.getItem("gcounsel_registered_counselors") || "[]");
        list = localList;
      } catch (e) {
        console.warn("Local storage counselor read notice:", e);
      }
    }

    // Default seeded staff if still empty
    if (!list.length) {
      list = [
        {
          id: "counselor_reyes_001",
          name: "Ms. A. Reyes",
          email: "a.reyes@school.edu.ph",
          title: "Guidance Counselor",
          credentials: "MS, RGC",
          role: "counselor",
          preferredAreas: ["Academic", "Career", "Personal", "Mental Wellness"],
          sessionsHandled: 15,
          sessionsCompleted: 12,
          status: "active",
        },
        {
          id: "counselor_kyle_001",
          name: "Kyle Cedric Carandang",
          email: "kyle.carandang@nu-fairview.edu.ph",
          title: "Lead Guidance Specialist",
          credentials: "RGC",
          role: "admin",
          preferredAreas: ["Academic", "Career", "Mental Wellness", "Family", "Social"],
          sessionsHandled: 8,
          sessionsCompleted: 6,
          status: "active",
        },
      ];
    }

    // Strict in-memory deduplication by normalized email
    const deduped = [];
    const seenEmails = new Set();
    for (const c of list) {
      const emailKey = (c.email || "").toLowerCase().trim();
      if (!emailKey) {
        deduped.push(c);
        continue;
      }
      if (seenEmails.has(emailKey)) {
        const existingIdx = deduped.findIndex((x) => (x.email || "").toLowerCase().trim() === emailKey);
        if (existingIdx >= 0) {
          const ex = deduped[existingIdx];
          if ((c.sessionsHandled || 0) > (ex.sessionsHandled || 0) || (!c.id.startsWith("counselor_") && ex.id.startsWith("counselor_"))) {
            deduped[existingIdx] = c;
          }
        }
        continue;
      }
      seenEmails.add(emailKey);
      deduped.push(c);
    }

    counselorsList = deduped;
  }

  async function fetchStats() {
    let url = "/api/admin-stats";
    if (!filterAllTime) {
      url += `?month=${currentMonth}&year=${currentYear}`;
    }

    try {
      const headers = {};
      if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        const idToken = await window.firebaseAuth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${idToken}`;
      }
      const res = await fetch(url, { headers });
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

    await fetchCounselors();
  }

  function getMonthName(m) {
    const d = new Date(2026, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long" });
  }

  function renderCounselorRows(list) {
    if (!list.length) {
      return `<tr><td colspan="8" class="empty-note" style="text-align: center;">No registered counselors or staff found. Click "+ Provision New Account" above to add faculty.</td></tr>`;
    }

    return list
      .map((c) => {
        const isRootAdmin =
          (c.email || "").toLowerCase() === "kylecarandang.work@gmail.com" ||
          (c.email || "").toLowerCase() === "kyle.carandang@nu-fairview.edu.ph";
        const roleLabel = c.role === "admin" ? "Office Administrator" : "Guidance Counselor";
        const roleBadgeClass = c.role === "admin" ? "badge-role-admin" : "badge-role-counselor";
        const statusLabel = c.status === "inactive" ? "Inactive" : "Active";
        const statusBadgeClass = c.status === "inactive" ? "badge-inactive" : "badge-active";
        const areas = Array.isArray(c.preferredAreas) && c.preferredAreas.length
          ? c.preferredAreas
          : ["Academic", "Career", "Personal", "Mental Wellness"];

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="counselor-avatar-circle">${escapeHtml((c.name || "C")[0].toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(c.name || "Staff Member")}</strong>
                  <br><small style="color:var(--text-secondary);">${escapeHtml(c.title || roleLabel)}</small>
                </div>
              </div>
            </td>
            <td><code>${escapeHtml(c.email || "—")}</code></td>
            <td><span class="status-badge ${roleBadgeClass}">${escapeHtml(roleLabel)}</span></td>
            <td><strong>${escapeHtml(c.credentials || "RGC")}</strong></td>
            <td>
              <div style="max-width: 260px; display: flex; flex-wrap: wrap;">
                ${areas.map((a) => `<span class="specialization-tag">${escapeHtml(a)}</span>`).join("")}
              </div>
            </td>
            <td>
              <span>${c.sessionsHandled || 0} sessions</span>
              <br><small style="color:#2e7d32; font-weight:600;">${c.sessionsCompleted || 0} completed</small>
            </td>
            <td>
              <span class="status-badge ${statusBadgeClass}">● ${statusLabel}</span>
            </td>
            <td style="text-align: right;">
              ${
                isRootAdmin
                  ? `<span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Primary Admin</span>`
                  : `<button type="button" class="btn btn-sm btn-danger delete-counselor-btn" data-counselor-id="${escapeHtml(c.id)}" data-counselor-name="${escapeHtml(c.name)}">Remove</button>`
              }
            </td>
          </tr>
        `;
      })
      .join("");
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
            <p class="pagesub">Comprehensive consultation metrics, staff scalability, category trends, program analytics, and appointment records.</p>
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
              + Add Counselor / Admin
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

        <!-- Staff & Counselor Accounts Management Section (Scaling Requirement) -->
        <div class="card" style="padding: 24px; margin-bottom: 28px;">
          <div class="section-title">
            <div>
              <span style="font-size: 15px; font-weight: 700;">👥 Guidance Counselor & Staff Accounts Directory</span>
              <span class="field-hint" style="display: block; margin-top: 2px;">Onboard faculty counseling staff, assign consultation specializations, provision roles, and scale office capacity.</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-dark btn-sm" id="innerAddCounselorBtn">+ Provision New Account</button>
              <a href="/signup.html" target="_blank" class="btn btn-sm" style="text-decoration: none;">↗ Faculty Self-Signup Portal</a>
            </div>
          </div>

          <!-- Staff Metrics Summary Sub-row -->
          <div style="display: flex; gap: 12px; margin: 16px 0 20px; flex-wrap: wrap;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; flex: 1; min-width: 140px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Total Staff Accounts</span>
              <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 2px;">${counselorsList.length}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; flex: 1; min-width: 140px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Active Counselors</span>
              <div style="font-size: 22px; font-weight: 800; color: #0369a1; margin-top: 2px;">${counselorsList.filter((c) => c.role !== "admin").length}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; flex: 1; min-width: 140px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Office Administrators</span>
              <div style="font-size: 22px; font-weight: 800; color: #6b21a8; margin-top: 2px;">${counselorsList.filter((c) => c.role === "admin").length}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; flex: 1; min-width: 140px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Scaling Status</span>
              <div style="font-size: 13px; font-weight: 700; color: #15803d; margin-top: 7px;">✓ Scalable (Dynamic Roster)</div>
            </div>
          </div>

          <!-- Staff Table -->
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Institutional Email</th>
                  <th>Account Role</th>
                  <th>Credentials</th>
                  <th>Specialization Areas</th>
                  <th>Consultations</th>
                  <th>Status</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${renderCounselorRows(counselorsList)}
              </tbody>
            </table>
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

                          const isActionable = a.status === "confirmed";

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
                                ${isActionable ? `
                                  <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button type="button" class="btn btn-sm btn-mark-complete-admin" data-id="${a.id}" title="Mark Completed">✓ Complete</button>
                                    <button type="button" class="btn btn-sm btn-mark-noshow-admin" data-id="${a.id}" title="Mark No-Show">✕ No-Show</button>
                                  </div>
                                ` : ""}
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

    // Historical appointment status updates from admin monitoring table
    document.querySelectorAll(".btn-mark-complete-admin").forEach((btn) => {
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

          await fetchStats();
          renderAdmin();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "✓ Complete";
        }
      });
    });

    document.querySelectorAll(".btn-mark-noshow-admin").forEach((btn) => {
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

          await fetchStats();
          renderAdmin();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "✕ No-Show";
        }
      });
    });

    // New Counselor Modal
    const modal = document.getElementById("newCounselorModal");
    const openBtn = document.getElementById("openNewCounselorModalBtn");
    const innerAddBtn = document.getElementById("innerAddCounselorBtn");
    const closeBtn = document.getElementById("closeNewCModalBtn");
    const form = document.getElementById("newCounselorForm");
    const errorBox = document.getElementById("newCError");
    const submitBtn = document.getElementById("submitNewCBtn");

    const openModalHandler = () => {
      errorBox.textContent = "";
      form.reset();
      modal.style.display = "flex";
    };

    if (openBtn && modal) {
      openBtn.onclick = openModalHandler;
    }
    if (innerAddBtn && modal) {
      innerAddBtn.onclick = openModalHandler;
    }

    if (closeBtn && modal) {
      closeBtn.onclick = () => {
        modal.style.display = "none";
      };
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (form.dataset.submitting === "true") return;
        form.dataset.submitting = "true";
        errorBox.textContent = "";

        const role = (document.getElementById("newCRole") ? document.getElementById("newCRole").value : "counselor");
        const name = document.getElementById("newCName").value.trim();
        const title = document.getElementById("newCTitle").value.trim();
        const credentials = document.getElementById("newCCredentials").value.trim();
        const email = document.getElementById("newCEmail").value.trim().toLowerCase();
        const password = document.getElementById("newCPassword").value;

        const selectedAreas = Array.from(document.querySelectorAll('input[name="newCAreas"]:checked')).map(
          (cb) => cb.value
        );

        if (!name || !email || !password) {
          errorBox.textContent = "Please fill in all required fields.";
          form.dataset.submitting = "false";
          return;
        }

        if (password.length < 6) {
          errorBox.textContent = "Password must be at least 6 characters.";
          form.dataset.submitting = "false";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Provisioning...";

        try {
          // Attempt creation via API (single authoritative source of truth for Auth + Firestore)
          let createdViaApi = false;
          try {
            const res = await fetch("/api/admin-counselors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                title,
                credentials,
                email,
                password,
                role,
                preferredAreas: selectedAreas,
              }),
            });

            const data = await res.json();
            if (res.ok) {
              createdViaApi = true;
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (apiErr) {
            if (apiErr.message.toLowerCase().includes("already exists")) {
              throw apiErr;
            }
            console.warn("API provisioning notice (falling back to client storage):", apiErr.message);
          }

          // ONLY fallback to direct Firestore write if the serverless API was unreachable
          if (!createdViaApi) {
            const newId = "counselor_" + Date.now();
            if (window.firestoreDb) {
              try {
                await window.firestoreDb.collection("counselors").doc(newId).set({
                  id: newId,
                  name,
                  title,
                  credentials,
                  email,
                  role,
                  preferredAreas: selectedAreas,
                  status: "active",
                  sessionsHandled: 0,
                  sessionsCompleted: 0,
                  createdAt: new Date().toISOString(),
                });
              } catch (fsErr) {
                console.warn("Firestore direct write notice:", fsErr.message);
              }
            }
          }

          // Clear any stale local mock cache to ensure clean roster
          try {
            localStorage.removeItem("gcounsel_registered_counselors");
          } catch (localErr) {}

          modal.style.display = "none";
          alert(`Staff account for ${name} (${role === "admin" ? "Administrator" : "Guidance Counselor"}) provisioned successfully.`);
          await fetchStats();
          renderAdmin();
        } catch (err) {
          errorBox.textContent = err.message || "Failed to provision account.";
        } finally {
          form.dataset.submitting = "false";
          submitBtn.disabled = false;
          submitBtn.textContent = "Provision Account";
        }
      };
    }

    // Counselor deletion buttons
    document.querySelectorAll(".delete-counselor-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const cId = btn.dataset.counselorId;
        const cName = btn.dataset.counselorName;

        if (!confirm(`Are you sure you want to remove the staff account for ${cName}?`)) {
          return;
        }

        try {
          const targetCounselor = counselorsList.find((c) => c.id === cId);
          const targetEmail = targetCounselor ? (targetCounselor.email || "").toLowerCase() : "";

          // Attempt DELETE via API
          try {
            await fetch("/api/admin-counselors", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ counselorId: cId }),
            });
          } catch (apiErr) {
            console.warn("API delete notice:", apiErr);
          }

          // Firestore delete
          if (window.firestoreDb) {
            try {
              await window.firestoreDb.collection("counselors").doc(cId).delete();
              if (targetEmail) {
                const matchSnap = await window.firestoreDb.collection("counselors").where("email", "==", targetEmail).get();
                matchSnap.forEach(async (d) => {
                  await window.firestoreDb.collection("counselors").doc(d.id).delete();
                });
              }
            } catch (fsErr) {
              console.warn("Firestore delete notice:", fsErr);
            }
          }

          // Local storage delete
          try {
            let registered = JSON.parse(localStorage.getItem("gcounsel_registered_counselors") || "[]");
            registered = registered.filter((c) => c.id !== cId && (targetEmail ? (c.email || "").toLowerCase() !== targetEmail : true));
            localStorage.setItem("gcounsel_registered_counselors", JSON.stringify(registered));
          } catch (e) {}

          alert(`Account for ${cName} has been removed.`);
          await fetchStats();
          renderAdmin();
        } catch (delErr) {
          alert(`Failed to remove counselor: ${delErr.message}`);
        }
      });
    });
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
