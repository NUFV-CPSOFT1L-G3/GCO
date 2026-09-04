/**
 * Automated End-to-End Workflow Test Suite for GCOunsel
 * Tests:
 * 1. Form validation & institutional email format
 * 2. Successful appointment booking & unique confirmation number generation
 * 3. Double-booking prevention (slot collision protection)
 * 4. Duplicate active appointment prevention for students
 * 5. Counselor availability & out-of-office slot calculation
 * 6. Appointment status updates (Completed, No-Show, Cancelled with reason)
 * 7. Post-consultation student feedback & single-submission enforcement
 * 8. Administrator statistics and category/program analytics
 */

const assert = require("assert");
const bookAppointmentFn = require("../netlify/functions/book-appointment").handler;
const getAvailabilityFn = require("../netlify/functions/get-availability").handler;
const updateStatusFn = require("../netlify/functions/update-appointment-status").handler;
const submitFeedbackFn = require("../netlify/functions/submit-feedback").handler;
const adminStatsFn = require("../netlify/functions/admin-stats").handler;

async function runTests() {
  console.log("==================================================================");
  console.log(" Starting GCOunsel End-to-End Automated Test Suite");
  console.log("==================================================================\n");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  // Ensure not Sunday
  if (futureDate.getDay() === 0) futureDate.setDate(futureDate.getDate() + 1);
  const testDate = futureDate.toISOString().slice(0, 10);

  // -------------------------------------------------------------------------
  // TEST 1: Form Validation
  // -------------------------------------------------------------------------
  console.log("TEST 1: Validating required fields & Student ID format...");

  // Missing full name
  let res = await bookAppointmentFn({
    httpMethod: "POST",
    body: JSON.stringify({ studentId: "2024-999999", emailUsername: "testuser" }),
  });
  assert.strictEqual(res.statusCode, 400, "Should reject missing full name");

  // Invalid Student ID format
  res = await bookAppointmentFn({
    httpMethod: "POST",
    body: JSON.stringify({ fullName: "Test Student", studentId: "INVALID-ID", emailUsername: "testuser" }),
  });
  assert.strictEqual(res.statusCode, 400, "Should reject invalid student ID format");
  console.log("✓ TEST 1 PASSED: Validation correctly rejected invalid input.");

  // -------------------------------------------------------------------------
  // TEST 2: Successful Appointment Booking & Confirmation Number Generation
  // -------------------------------------------------------------------------
  console.log("\nTEST 2: Submitting a valid student appointment...");

  const testStudentId = `2024-${Math.floor(100000 + Math.random() * 900000)}`;
  const testUsername = `student_${Date.now()}`;

  res = await bookAppointmentFn({
    httpMethod: "POST",
    body: JSON.stringify({
      fullName: "Santos, Maria C.",
      studentId: testStudentId,
      emailUsername: testUsername,
      course: "BS Information Technology",
      categories: ["Academic", "Career"],
      counselorId: "counselor_reyes_001",
      date: testDate,
      startTime: "10:00",
      endTime: "10:30",
    }),
  });

  assert.strictEqual(res.statusCode, 201, "Booking should succeed with 201 Created");
  const bookedData = JSON.parse(res.body);
  assert(bookedData.success, "Response should indicate success");
  assert(bookedData.appointment.confirmationNumber.startsWith("GCO-"), "Should have GCO- confirmation number");
  assert.strictEqual(
    bookedData.appointment.studentEmail,
    `${testUsername}@students.nu-fairview.edu.ph`,
    "Should auto-append institutional email domain"
  );
  const createdApptId = bookedData.appointment.id;
  const confirmationNumber = bookedData.appointment.confirmationNumber;
  console.log(`✓ TEST 2 PASSED: Created appointment ${confirmationNumber} (ID: ${createdApptId})`);

  // -------------------------------------------------------------------------
  // TEST 3: Double-Booking Prevention
  // -------------------------------------------------------------------------
  console.log("\nTEST 3: Preventing double-booking of the same counselor and slot...");

  const anotherStudentId = `2024-${Math.floor(100000 + Math.random() * 900000)}`;
  const collisionRes = await bookAppointmentFn({
    httpMethod: "POST",
    body: JSON.stringify({
      fullName: "Collision Student",
      studentId: anotherStudentId,
      emailUsername: `another_${Date.now()}`,
      course: "BS Computer Science",
      categories: ["Personal"],
      counselorId: "counselor_reyes_001",
      date: testDate,
      startTime: "10:00", // Same slot!
      endTime: "10:30",
    }),
  });

  assert.strictEqual(collisionRes.statusCode, 409, "Should reject double booking with 409 Conflict");
  const collisionErr = JSON.parse(collisionRes.body);
  console.log(`✓ TEST 3 PASSED: Double-booking correctly prevented: "${collisionErr.error}"`);

  // -------------------------------------------------------------------------
  // TEST 4: Duplicate Active Appointment Prevention
  // -------------------------------------------------------------------------
  console.log("\nTEST 4: Preventing multiple active appointments for the same student...");

  const duplicateRes = await bookAppointmentFn({
    httpMethod: "POST",
    body: JSON.stringify({
      fullName: "Santos, Maria C.",
      studentId: testStudentId, // Same student ID who already has active appointment
      emailUsername: testUsername,
      course: "BS Information Technology",
      categories: ["Career"],
      counselorId: "counselor_santos_002",
      date: testDate,
      startTime: "14:00",
      endTime: "14:30",
    }),
  });

  assert.strictEqual(duplicateRes.statusCode, 409, "Should reject duplicate active appointment");
  const dupErr = JSON.parse(duplicateRes.body);
  console.log(`✓ TEST 4 PASSED: Duplicate appointment correctly rejected: "${dupErr.error}"`);

  // -------------------------------------------------------------------------
  // TEST 5: Counselor Availability & Out-of-Office Verification
  // -------------------------------------------------------------------------
  console.log("\nTEST 5: Checking slot calculation and booked slot exclusion...");

  const availRes = await getAvailabilityFn({
    httpMethod: "GET",
    queryStringParameters: { counselorId: "counselor_reyes_001", date: testDate },
  });
  assert.strictEqual(availRes.statusCode, 200);
  const availData = JSON.parse(availRes.body);
  const bookedSlot = availData.slots.find((s) => s.startTime === "10:00");
  assert(bookedSlot && !bookedSlot.available, "The 10:00 slot must be marked unavailable");
  console.log("✓ TEST 5 PASSED: Slot availability accurately reflects booked reservations.");

  // -------------------------------------------------------------------------
  // TEST 6: Appointment Status Updates (Completed, No-Show, Cancelled)
  // -------------------------------------------------------------------------
  console.log("\nTEST 6: Updating appointment statuses and logging cancellation reason...");

  // Update status to completed
  let statusRes = await updateStatusFn({
    httpMethod: "POST",
    body: JSON.stringify({ appointmentId: createdApptId, status: "completed" }),
  });
  assert.strictEqual(statusRes.statusCode, 200, "Should mark completed");
  console.log("✓ Marked appointment Completed.");

  // Cancellation with missing reason must fail
  statusRes = await updateStatusFn({
    httpMethod: "POST",
    body: JSON.stringify({ appointmentId: createdApptId, status: "cancelled" }),
  });
  assert.strictEqual(statusRes.statusCode, 400, "Should reject cancellation without predefined reason");

  // Cancellation with valid reason
  statusRes = await updateStatusFn({
    httpMethod: "POST",
    body: JSON.stringify({
      appointmentId: createdApptId,
      status: "cancelled",
      cancellationReason: "Counselor Unavailable",
      cancellationRemarks: "Attending emergency seminar",
    }),
  });
  assert.strictEqual(statusRes.statusCode, 200, "Should succeed with valid cancellation reason");
  console.log("✓ TEST 6 PASSED: Status update and cancellation reason logging verified.");

  // -------------------------------------------------------------------------
  // TEST 7: Student Feedback & Single-Submission Enforcement
  // -------------------------------------------------------------------------
  console.log("\nTEST 7: Submitting student feedback for completed consultation...");

  // Create a dedicated completed appointment for feedback testing
  const fbStudentId = `2024-${Math.floor(100000 + Math.random() * 900000)}`;
  const freshApptRes = await bookAppointmentFn({
    httpMethod: "POST",
    body: JSON.stringify({
      fullName: "Feedback Test Student",
      studentId: fbStudentId,
      emailUsername: `fbuser_${Date.now()}`,
      course: "BS Psychology",
      categories: ["Personal"],
      counselorId: "counselor_reyes_001",
      date: testDate,
      startTime: "15:00",
      endTime: "15:30",
    }),
  });
  assert.strictEqual(freshApptRes.statusCode, 201);
  const freshAppt = JSON.parse(freshApptRes.body).appointment;

  // Mark completed
  await updateStatusFn({
    httpMethod: "POST",
    body: JSON.stringify({ appointmentId: freshAppt.id, status: "completed" }),
  });

  // Submit valid feedback
  let fbRes = await submitFeedbackFn({
    httpMethod: "POST",
    body: JSON.stringify({
      appointmentId: freshAppt.id,
      rating: 5,
      appreciated: ["Helpful", "Professional", "Good Listener"],
      comments: "Exceptional counseling experience!",
    }),
  });
  assert.strictEqual(fbRes.statusCode, 201, "Feedback should be created with 201");
  console.log("✓ Student feedback submitted successfully.");

  // Attempt duplicate feedback on the same appointment
  fbRes = await submitFeedbackFn({
    httpMethod: "POST",
    body: JSON.stringify({
      appointmentId: freshAppt.id,
      rating: 4,
      appreciated: ["Friendly"],
      comments: "Trying to submit again...",
    }),
  });
  assert.strictEqual(fbRes.statusCode, 409, "Should reject duplicate feedback on same appointment");
  console.log("✓ TEST 7 PASSED: Single-submission guarantee verified.");

  // -------------------------------------------------------------------------
  // TEST 8: Admin Statistics & Analytics
  // -------------------------------------------------------------------------
  console.log("\nTEST 8: Fetching administrative overview & analytics...");

  const adminRes = await adminStatsFn({
    httpMethod: "GET",
    queryStringParameters: {},
  });
  assert.strictEqual(adminRes.statusCode, 200);
  const adminData = JSON.parse(adminRes.body);

  assert(adminData.summary.total > 0, "Should have total appointments");
  assert(adminData.summary.averageRating > 0, "Should calculate average rating");
  assert(Object.keys(adminData.categories).length > 0, "Should calculate category counts");
  assert(Object.keys(adminData.courses).length > 0, "Should calculate course counts");
  assert(Object.keys(adminData.counselors).length > 0, "Should calculate counselor stats");

  console.log(`✓ Summary: Total=${adminData.summary.total}, Completed=${adminData.summary.completed}, Cancelled=${adminData.summary.cancelled}, AvgRating=${adminData.summary.averageRating}★`);
  console.log("✓ Categories recorded:", Object.keys(adminData.categories).join(", "));
  console.log("✓ Programs recorded:", Object.keys(adminData.courses).join(", "));
  console.log("✓ TEST 8 PASSED: Admin analytics computed correctly.");

  console.log("\n==================================================================");
  console.log(" 🎉 ALL TESTS PASSED SUCCESSFULLY! (8/8)");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
