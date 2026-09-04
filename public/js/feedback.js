/**
 * Student Feedback Survey Interaction Script (User Screen 3)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const loadingBox = document.getElementById("loadingBox");
  const feedbackNoticeBox = document.getElementById("feedbackNoticeBox");
  const surveyFormArea = document.getElementById("surveyFormArea");
  const counselorTargetName = document.getElementById("counselorTargetName");
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackError = document.getElementById("feedbackError");
  const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
  const thankYouBox = document.getElementById("thankYouBox");

  const starContainer = document.getElementById("starContainer");
  const selectedRatingInput = document.getElementById("selectedRating");

  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get("appointmentId");

  if (!appointmentId) {
    loadingBox.style.display = "none";
    feedbackNoticeBox.textContent = "Invalid survey link. Please open the feedback link provided in your consultation completion email.";
    feedbackNoticeBox.style.display = "block";
    return;
  }

  // 1. Verify Appointment Status
  try {
    const res = await fetch(`/api/submit-feedback?appointmentId=${encodeURIComponent(appointmentId)}`);
    const data = await res.json();

    loadingBox.style.display = "none";

    if (!res.ok) {
      feedbackNoticeBox.textContent = data.error || "Unable to load consultation details.";
      feedbackNoticeBox.style.display = "block";
      return;
    }

    if (data.status !== "completed") {
      feedbackNoticeBox.textContent = "This consultation has not yet been marked as Completed by your guidance counselor.";
      feedbackNoticeBox.style.display = "block";
      return;
    }

    if (data.hasFeedback) {
      feedbackNoticeBox.textContent = "You have already submitted feedback for this consultation session. In accordance with GCO policy, only one feedback submission is permitted per completed appointment.";
      feedbackNoticeBox.style.display = "block";
      return;
    }

    // Show Survey Form
    counselorTargetName.textContent = data.counselorName || "Guidance Counselor";
    surveyFormArea.style.display = "block";
  } catch (err) {
    loadingBox.style.display = "none";
    feedbackNoticeBox.textContent = "Failed to connect to the server. Please try again later.";
    feedbackNoticeBox.style.display = "block";
    return;
  }

  // 2. Star Rating Interactions
  const stars = starContainer.querySelectorAll(".star");
  let currentRating = 0;

  function updateStars(rating) {
    stars.forEach((star) => {
      const val = Number(star.dataset.value);
      if (val <= rating) {
        star.classList.add("active");
      } else {
        star.classList.remove("active");
      }
    });
  }

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      currentRating = Number(star.dataset.value);
      selectedRatingInput.value = currentRating;
      updateStars(currentRating);
      feedbackError.textContent = "";
    });

    star.addEventListener("mouseenter", () => {
      updateStars(Number(star.dataset.value));
    });
  });

  starContainer.addEventListener("mouseleave", () => {
    updateStars(currentRating);
  });

  // 3. Submit Feedback
  feedbackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedbackError.textContent = "";

    const rating = Number(selectedRatingInput.value);
    if (!rating || rating < 1 || rating > 5) {
      feedbackError.textContent = "Please select an overall rating (1 to 5 stars).";
      return;
    }

    const appreciated = Array.from(
      document.querySelectorAll('input[name="appreciated"]:checked')
    ).map((cb) => cb.value);

    const comments = document.getElementById("comments").value.trim();

    submitFeedbackBtn.disabled = true;
    submitFeedbackBtn.textContent = "Submitting...";

    try {
      const res = await fetch("/api/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          rating,
          appreciated,
          comments,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit feedback.");
      }

      surveyFormArea.style.display = "none";
      thankYouBox.style.display = "block";
    } catch (err) {
      feedbackError.textContent = err.message;
      submitFeedbackBtn.disabled = false;
      submitFeedbackBtn.textContent = "Submit Feedback";
    }
  });
});
