/**
 * Counselor Availability & Out-of-Office Management Logic
 */

const DAY_ORDER = [1, 2, 3, 4, 5, 6]; // Mon to Sat
const DAY_LABELS = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 0: "Sunday" };
const DURATION_OPTIONS = [15, 20, 30, 45, 60];

function formatDateLabel(isoDate) {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

(async () => {
  const user = await requireAuth("counselor");
  if (!user) return;

  let counselorData = user;

  // Load latest counselor settings from Firestore
  if (window.firestoreDb && user.uid) {
    try {
      const doc = await window.firestoreDb.collection("counselors").doc(user.uid).get();
      if (doc.exists) {
        counselorData = { uid: user.uid, ...doc.data() };
      }
    } catch (err) {
      console.warn("Could not load availability from Firestore:", err.message);
    }
  }

  // Ensure weeklyHours default structure exists
  if (!counselorData.weeklyHours || !counselorData.weeklyHours.length) {
    counselorData.weeklyHours = [
      { dayOfWeek: 0, isActive: false, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 1, isActive: true, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 2, isActive: true, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 3, isActive: true, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 4, isActive: true, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 5, isActive: true, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 6, isActive: false, startTime: "08:00", endTime: "12:00" },
    ];
  }

  if (!counselorData.blockedDates) {
    counselorData.blockedDates = [];
  }

  if (!counselorData.defaultDurationMinutes) {
    counselorData.defaultDurationMinutes = 30;
  }

  let draftState = JSON.parse(JSON.stringify(counselorData));

  function findDayByNumber(dayNum) {
    return draftState.weeklyHours.find((d) => d.dayOfWeek === dayNum);
  }

  function renderForm() {
    const weeklyRows = DAY_ORDER.map((dayNum) => {
      const dayConfig = findDayByNumber(dayNum) || {
        dayOfWeek: dayNum,
        isActive: false,
        startTime: "08:00",
        endTime: "17:00",
      };

      return `
        <div class="avail-day-row ${dayConfig.isActive ? "" : "disabled"}">
          <button type="button" class="toggle ${dayConfig.isActive ? "" : "off"}" data-day="${dayNum}">
            <div class="knob"></div>
          </button>
          <div class="daylabel">${DAY_LABELS[dayNum]}</div>
          <input type="time" class="timeinput" data-day="${dayNum}" data-field="startTime" value="${dayConfig.startTime}" ${dayConfig.isActive ? "" : "disabled"} />
          <div class="dash">to</div>
          <input type="time" class="timeinput" data-day="${dayNum}" data-field="endTime" value="${dayConfig.endTime}" ${dayConfig.isActive ? "" : "disabled"} />
        </div>
      `;
    }).join("");

    const durationButtons = DURATION_OPTIONS.map(
      (mins) => `
        <button type="button" class="btn ${draftState.defaultDurationMinutes === mins ? "btn-dark" : ""}" data-duration="${mins}">
          ${mins} min
        </button>
      `
    ).join("");

    const blockedItems = draftState.blockedDates.length
      ? draftState.blockedDates
          .map(
            (b, idx) => `
              <div class="block-item">
                <div>
                  <strong>${formatDateLabel(b.date)}</strong>
                  ${b.reason ? `<br><span class="block-reason-text">${escapeHtml(b.reason)}</span>` : ""}
                </div>
                <span class="remove" data-remove-index="${idx}" title="Remove blocked period">✕</span>
              </div>
            `
          )
          .join("")
      : `<div class="empty-note">No blocked dates scheduled.</div>`;

    document.getElementById("app").innerHTML = `
      ${renderNav("availability", counselorData)}
      <div class="main">
        <h1 class="pagetitle">Availability & Out-of-Office Settings</h1>
        <p class="pagesub">Configure recurring consultation hours, consultation session lengths, and blocked out-of-office dates.</p>

        <div class="availability-grid">
          <div class="avail-left-col">
            <div class="section-title"><span>Weekly Consultation Hours</span></div>
            ${weeklyRows}

            <div class="section-title" style="margin-top: 24px;"><span>Default Consultation Session Length</span></div>
            <div class="card" style="padding: 16px; display: flex; gap: 10px; flex-wrap: wrap;" id="durationRow">
              ${durationButtons}
            </div>
          </div>

          <div class="avail-right-col">
            <div class="section-title"><span>Out-of-Office / Blocked Dates</span></div>
            <div class="card" style="padding: 20px;">
              <p class="field-hint" style="margin-bottom: 14px;">
                Add dates when you will be attending seminars, on leave, or unavailable for consultations. Students will not be able to reserve slots on these dates.
              </p>
              
              <div id="blockedList">${blockedItems}</div>

              <div style="margin-top: 16px; border-top: 1px solid var(--border-soft); padding-top: 16px;">
                <div class="field-block">
                  <label class="field-label" for="newBlockedDate">Date to Block</label>
                  <input type="date" class="field-input" id="newBlockedDate" min="${new Date().toISOString().slice(0, 10)}" />
                </div>
                <div class="field-block">
                  <label class="field-label" for="newBlockedReason">Reason (e.g. Faculty In-Service Day, Medical Leave)</label>
                  <input type="text" class="field-input" id="newBlockedReason" placeholder="Reason for absence" />
                </div>
                <button type="button" class="btn btn-dark" style="width: 100%;" id="addBlockedDate">
                  + Add Blocked Date
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top: 28px; display: flex; justify-content: flex-end; align-items: center; gap: 16px;">
          <div class="errorMessage" id="saveStatusMsg" style="margin: 0;"></div>
          <button type="button" class="btn btn-dark" style="padding: 12px 28px; font-size: 14px;" id="saveChangesBtn">
            Save Availability Settings
          </button>
        </div>
      </div>
      </div>
    `;

    attachNavHandlers();
    attachFormHandlers();
  }

  function attachFormHandlers() {
    // Toggles
    document.querySelectorAll(".toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const day = findDayByNumber(Number(btn.dataset.day));
        if (day) {
          day.isActive = !day.isActive;
          renderForm();
        }
      });
    });

    // Time Inputs
    document.querySelectorAll(".timeinput").forEach((inp) => {
      inp.addEventListener("change", () => {
        const day = findDayByNumber(Number(inp.dataset.day));
        if (day) {
          day[inp.dataset.field] = inp.value;
        }
      });
    });

    // Duration buttons
    document.getElementById("durationRow").querySelectorAll("[data-duration]").forEach((btn) => {
      btn.addEventListener("click", () => {
        draftState.defaultDurationMinutes = Number(btn.dataset.duration);
        renderForm();
      });
    });

    // Add Blocked Date
    document.getElementById("addBlockedDate").addEventListener("click", () => {
      const dateInp = document.getElementById("newBlockedDate");
      const reasonInp = document.getElementById("newBlockedReason");

      if (!dateInp.value) {
        alert("Please select a date to block.");
        return;
      }

      draftState.blockedDates.push({
        date: dateInp.value,
        reason: reasonInp.value.trim() || "Out of Office",
      });

      draftState.blockedDates.sort((a, b) => a.date.localeCompare(b.date));
      renderForm();
    });

    // Remove Blocked Date
    document.querySelectorAll("[data-remove-index]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeIndex);
        draftState.blockedDates.splice(idx, 1);
        renderForm();
      });
    });

    // Save Changes to Firestore
    document.getElementById("saveChangesBtn").addEventListener("click", async () => {
      const statusMsg = document.getElementById("saveStatusMsg");
      const saveBtn = document.getElementById("saveChangesBtn");
      statusMsg.textContent = "";

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        if (window.firestoreDb && (user.uid || user.id)) {
          await window.firestoreDb.collection("counselors").doc(user.uid || user.id).update({
            weeklyHours: draftState.weeklyHours,
            defaultDurationMinutes: draftState.defaultDurationMinutes,
            blockedDates: draftState.blockedDates,
            updatedAt: new Date().toISOString(),
          });
        }

        counselorData = JSON.parse(JSON.stringify(draftState));
        statusMsg.style.color = "#2e7d32";
        statusMsg.textContent = "✓ Availability settings saved successfully.";
      } catch (err) {
        console.error("Save error:", err);
        statusMsg.style.color = "var(--danger)";
        statusMsg.textContent = err.message || "Failed to save settings.";
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Availability Settings";
      }
    });
  }

  renderForm();
})();
