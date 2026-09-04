/**
 * Student Booking Portal Logic (User Screen 1 & 2)
 */

document.addEventListener("DOMContentLoaded", () => {
  const counselorSelect = document.getElementById("counselorSelect");
  const appointmentDate = document.getElementById("appointmentDate");
  const slotBlock = document.getElementById("slotBlock");
  const slotsLoading = document.getElementById("slotsLoading");
  const slotsNotice = document.getElementById("slotsNotice");
  const slotsGrid = document.getElementById("slotsGrid");
  const selectedStartTime = document.getElementById("selectedStartTime");
  const selectedEndTime = document.getElementById("selectedEndTime");
  const form = document.getElementById("appointmentForm");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");

  const confirmationModal = document.getElementById("confirmationModal");
  const closeModalBtn = document.getElementById("closeModalBtn");

  // Prevent past dates in datepicker
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  appointmentDate.min = todayISO;

  // Max 60 days into future
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  appointmentDate.max = maxDate.toISOString().slice(0, 10);

  // 1. Load Counselors dynamically
  async function loadCounselors() {
    try {
      let counselors = [];

      // Try reading directly from Firestore if available
      if (window.firestoreDb) {
        try {
          const snapshot = await window.firestoreDb.collection("counselors").get();
          snapshot.forEach((doc) => {
            const data = doc.data();
            counselors.push({ id: doc.id, ...data });
          });
        } catch (fsErr) {
          console.warn("Direct Firestore read fallback to API:", fsErr.message);
        }
      }

      // Fallback to Netlify function endpoint
      if (!counselors.length) {
        const res = await fetch("/api/admin-counselors");
        if (res.ok) {
          counselors = await res.json();
        }
      }

      if (!counselors.length) {
        counselorSelect.innerHTML = `<option value="">No counselors currently available</option>`;
        return;
      }

      counselorSelect.innerHTML = `
        <option value="">-- Choose a guidance counselor --</option>
        ${counselors
          .map(
            (c) =>
              `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.title || "Guidance Counselor")})</option>`
          )
          .join("")}
      `;
    } catch (err) {
      console.error("Failed to load counselors:", err);
      counselorSelect.innerHTML = `<option value="">Error loading counselors</option>`;
    }
  }

  // 2. Fetch and render available time slots
  async function loadAvailableSlots() {
    const counselorId = counselorSelect.value;
    const date = appointmentDate.value;

    selectedStartTime.value = "";
    selectedEndTime.value = "";
    slotsGrid.innerHTML = "";
    slotsNotice.style.display = "none";

    if (!counselorId || !date) {
      slotBlock.style.display = "none";
      return;
    }

    slotBlock.style.display = "block";
    slotsLoading.style.display = "block";

    try {
      const res = await fetch(`/api/get-availability?counselorId=${encodeURIComponent(counselorId)}&date=${encodeURIComponent(date)}`);
      const data = await res.json();

      slotsLoading.style.display = "none";

      if (!data.available) {
        slotsNotice.textContent = data.reason || "The selected counselor is not available on this date.";
        slotsNotice.style.display = "block";
        return;
      }

      const availableSlots = (data.slots || []).filter((s) => s.available);

      if (!availableSlots.length) {
        slotsNotice.textContent = "All consultation slots for this date are fully booked or have passed. Please select another date.";
        slotsNotice.style.display = "block";
        return;
      }

      slotsGrid.innerHTML = availableSlots
        .map(
          (slot) => `
          <button type="button" class="slot-pill" data-start="${slot.startTime}" data-end="${slot.endTime}">
            ${slot.label}
          </button>
        `
        )
        .join("");

      // Attach click events on slot pills
      slotsGrid.querySelectorAll(".slot-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          slotsGrid.querySelectorAll(".slot-pill").forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
          selectedStartTime.value = pill.dataset.start;
          selectedEndTime.value = pill.dataset.end;
          formError.textContent = "";
        });
      });
    } catch (err) {
      slotsLoading.style.display = "none";
      slotsNotice.textContent = "Failed to load consultation slots. Please try again.";
      slotsNotice.style.display = "block";
      console.error(err);
    }
  }

  counselorSelect.addEventListener("change", loadAvailableSlots);
  appointmentDate.addEventListener("change", loadAvailableSlots);

  // 3. Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";

    const fullName = document.getElementById("fullName").value.trim();
    const studentId = document.getElementById("studentId").value.trim();
    const emailUsername = document.getElementById("emailUsername").value.trim();
    const course = document.getElementById("course").value;
    const counselorId = counselorSelect.value;
    const date = appointmentDate.value;
    const startTime = selectedStartTime.value;
    const endTime = selectedEndTime.value;

    // Reason checkboxes
    const checkedCategories = Array.from(
      document.querySelectorAll('input[name="category"]:checked')
    ).map((cb) => cb.value);

    // Validation
    if (!fullName) {
      formError.textContent = "Please enter your Full Name.";
      return;
    }

    if (!/^\d{4}-\d{6}$/.test(studentId)) {
      formError.textContent = "Student ID must follow the format: 20XX-XXXXXX (e.g. 2024-123456).";
      return;
    }

    if (!emailUsername) {
      formError.textContent = "Please enter your NU institutional email username.";
      return;
    }

    if (!course) {
      formError.textContent = "Please select your course or program.";
      return;
    }

    if (checkedCategories.length === 0) {
      formError.textContent = "Please select at least one reason for consultation.";
      return;
    }

    if (!counselorId) {
      formError.textContent = "Please select a guidance counselor.";
      return;
    }

    if (!date) {
      formError.textContent = "Please select a consultation date.";
      return;
    }

    if (!startTime) {
      formError.textContent = "Please select an available consultation time slot.";
      return;
    }

    // Submit payload
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Appointment...";

    try {
      const response = await fetch("/api/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          studentId,
          emailUsername,
          course,
          categories: checkedCategories,
          counselorId,
          date,
          startTime,
          endTime,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process appointment.");
      }

      // Show Confirmation Card (User Screen 2)
      document.getElementById("resConfirmationNumber").textContent = result.appointment.confirmationNumber;
      document.getElementById("resCounselor").textContent = result.appointment.counselorName;
      document.getElementById("resDate").textContent = formatDate(result.appointment.date);
      document.getElementById("resTime").textContent = `${formatTime12h(result.appointment.startTime)} – ${formatTime12h(result.appointment.endTime)}`;
      document.getElementById("resEmail").textContent = result.appointment.studentEmail;

      confirmationModal.style.display = "flex";
      form.reset();
      slotBlock.style.display = "none";
    } catch (err) {
      formError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Appointment";
    }
  });

  closeModalBtn.addEventListener("click", () => {
    confirmationModal.style.display = "none";
  });

  function formatDate(isoStr) {
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function formatTime12h(time24) {
    if (!time24) return "";
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  loadCounselors();
});
