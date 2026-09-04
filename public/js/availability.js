const DAY_ORDER = [1, 2, 3, 4, 5, 6];
const DAY_LABELS = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };
const DURATION_OPTIONS = [15, 20, 30, 45, 60];

function formatDateLabel(isoDate) {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

(async () => {
  const counselor = await requireCounselor();
  if (!counselor) return;

  let availabilityState = await api.get("/api/availability");
  let draftState = JSON.parse(JSON.stringify(availabilityState));

  function findDayByNumber(dayNumber) {
    return draftState.weeklyHours.find((day) => day.dayOfWeek === dayNumber);
  }

  function renderAvailabilityForm() {
    const weeklyRows = DAY_ORDER.map((dayNumber) => {
      const dayConfig = findDayByNumber(dayNumber) || { dayOfWeek: dayNumber, isActive: false, startTime: "09:00", endTime: "18:00" };
      return `
        <div class="avail-day-row ${dayConfig.isActive ? "" : "disabled"}">
          <button type="button" class="toggle ${dayConfig.isActive ? "" : "off"}" data-day="${dayNumber}"><div class="knob"></div></button>
          <div class="daylabel">${DAY_LABELS[dayNumber]}</div>
          <input type="time" class="timeinput" data-day="${dayNumber}" data-field="startTime" value="${dayConfig.startTime}" ${dayConfig.isActive ? "" : "disabled"} />
          <div class="dash">to</div>
          <input type="time" class="timeinput" data-day="${dayNumber}" data-field="endTime" value="${dayConfig.endTime}" ${dayConfig.isActive ? "" : "disabled"} />
        </div>
      `;
    }).join("");

    const durationButtons = DURATION_OPTIONS.map(
      (minutes) => `<div class="btn ${draftState.settings.defaultDurationMinutes === minutes ? "btn-dark" : ""}" data-duration="${minutes}">${minutes} min</div>`
    ).join("");

    const blockedItems = draftState.blockedDates.length
      ? draftState.blockedDates
          .map(
            (blockedDate) => `
              <div class="block-item">
                <div><strong>${formatDateLabel(blockedDate.date)}</strong>${blockedDate.reason ? `<br><span style="color:var(--text-secondary); font-size:11px;">${escapeHtml(blockedDate.reason)}</span>` : ""}</div>
                <span class="remove" data-remove-id="${blockedDate.id}">✕</span>
              </div>
            `
          )
          .join("")
      : `<div class="empty-note">No blocked dates.</div>`;

    document.getElementById("app").innerHTML = `
      ${renderNav("availability", counselor)}
      <div class="main">
        <h1 class="pagetitle">Availability Settings</h1>
        <p class="pagesub">Set your recurring office hours and block off dates you're unavailable.</p>

        <div style="display:flex; gap:32px;">
          <div style="flex:1.4;">
            <div class="section-title"><span>Weekly Office Hours</span></div>
            ${weeklyRows}

            <div class="section-title" style="margin-top:24px;"><span>Default Session Length</span></div>
            <div class="card" style="padding:16px; display:flex; gap:12px;" id="durationRow">
              ${durationButtons}
            </div>
          </div>

          <div style="flex:1;">
            <div class="section-title"><span>Blocked Dates</span></div>
            <div class="card" style="padding:16px;">
              <div id="blockedList">${blockedItems}</div>
              <div style="display:flex; gap:8px; margin-top:10px;">
                <input type="date" class="field-input" id="newBlockedDate" />
                <input type="text" class="field-input" id="newBlockedReason" placeholder="Reason (optional)" />
              </div>
              <div class="btn" style="width:100%; margin-top:8px;" id="addBlockedDate">+ Add Blocked Date</div>
            </div>

          </div>
        </div>

        <div style="margin-top:28px; text-align:right;">
          <span class="btn btn-dark" style="padding:12px 24px;" id="saveChanges">Save Changes</span>
          <div class="errorMessage" id="errorMsg" style="text-align:right;"></div>
        </div>
      </div>
      </div>
    `;

    attachLogoutHandler();
    attachEventHandlers();
  }

  function attachEventHandlers() {
    document.querySelectorAll(".toggle").forEach((toggleButton) => {
      toggleButton.addEventListener("click", () => {
        const day = findDayByNumber(Number(toggleButton.dataset.day));
        day.isActive = !day.isActive;
        renderAvailabilityForm();
      });
    });

    document.querySelectorAll(".timeinput").forEach((timeInput) => {
      timeInput.addEventListener("change", () => {
        const day = findDayByNumber(Number(timeInput.dataset.day));
        day[timeInput.dataset.field] = timeInput.value;
      });
    });

    document.getElementById("durationRow").querySelectorAll("[data-duration]").forEach((durationButton) => {
      durationButton.addEventListener("click", () => {
        draftState.settings.defaultDurationMinutes = Number(durationButton.dataset.duration);
        renderAvailabilityForm();
      });
    });

    document.getElementById("addBlockedDate").addEventListener("click", () => {
      const dateInput = document.getElementById("newBlockedDate");
      const reasonInput = document.getElementById("newBlockedReason");

      if (!dateInput.value) return;

      const newBlockedDate = {
        id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: dateInput.value,
        reason: reasonInput.value.trim(),
      };

      draftState.blockedDates.push(newBlockedDate);
      draftState.blockedDates.sort((a, b) => a.date.localeCompare(b.date));
      dateInput.value = "";
      reasonInput.value = "";
      renderAvailabilityForm();
    });

    document.getElementById("blockedList").querySelectorAll("[data-remove-id]").forEach((removeButton) => {
      removeButton.addEventListener("click", () => {
        const id = removeButton.dataset.removeId;
        draftState.blockedDates = draftState.blockedDates.filter(
          (blockedDate) => String(blockedDate.id) !== String(id)
        );
        renderAvailabilityForm();
      });
    });

    document.getElementById("saveChanges").addEventListener("click", async () => {
      const errorMessage = document.getElementById("errorMsg");
      errorMessage.textContent = "";

      try {
        const payload = {
          weeklyHours: draftState.weeklyHours,
          defaultDurationMinutes: draftState.settings.defaultDurationMinutes,
          blockedDates: draftState.blockedDates.map(({ date, reason }) => ({ date, reason: reason || "" })),
        };

        await api.put("/api/availability", payload);

        availabilityState = JSON.parse(JSON.stringify(draftState));

        errorMessage.style.color = "var(--text-secondary)";
        errorMessage.textContent = "Saved.";
      } catch (error) {
        errorMessage.style.color = "var(--danger)";
        errorMessage.textContent = error.message;
      }
    });
  }

  renderAvailabilityForm();
})();
