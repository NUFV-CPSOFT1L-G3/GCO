# GCOunsel — Guidance Counseling Appointment Management System
### National University – Fairview

A secure, modern, serverless web application designed to streamline student consultation bookings, schedule management for registered guidance counselors, and administrative reporting for the Guidance Counseling Office (GCO) at National University – Fairview.

---

## 📋 Table of Contents
- [Overview & Architecture](#-overview--architecture)
- [Feature Highlights](#-feature-highlights)
  - [1. Student Booking Portal](#1-student-booking-portal)
  - [2. Post-Consultation Feedback Survey](#2-post-consultation-feedback-survey)
  - [3. Counselor Dashboard & Schedule Management](#3-counselor-dashboard--schedule-management)
  - [4. Administrator Analytics & Operations](#4-administrator-analytics--operations)
- [Technology Stack](#-technology-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Environment Variables Configuration](#-environment-variables-configuration)
  - [Local `.env` File](#local-env-file)
  - [Netlify Production Environment Variables](#netlify-production-environment-variables)
- [Quick Start / Local Development](#-quick-start--local-development)
- [Deployment to Netlify (GitHub CI/CD)](#-deployment-to-netlify-github-cicd)
- [Automated Testing Suite](#-automated-testing-suite)
- [Security, Privacy, and Compliance](#-security-privacy-and-compliance)

---

## 🏛 Overview & Architecture

GCOunsel replaces manual, paper-based consultation logs and disjointed scheduling with a centralized, reactive web platform. It is engineered with a **JAMstack serverless architecture**:

```
[ Students & Faculty Browsers ]
             │
             ▼
[ Netlify CDN Edge (HTML/CSS/JS) ]
             │
             ├──► Netlify Serverless Functions (/api/*)
             │             │
             │             ├──► Cloud Firestore (Transactional NoSQL DB)
             │             └──► Nodemailer (SMTP / Gmail Notifications)
             │
             └──► Firebase Authentication (Direct Client Auth)
```

- **Zero-Login for Students:** Students schedule appointments without creating an account; identity is verified using their official institutional email domain (`@students.nu-fairview.edu.ph`) and valid Student ID (`20XX-XXXXXX`).
- **Authenticated Staff & Admin Portal:** Guidance counselors and administrators authenticate via Firebase Authentication (Email/Password or Microsoft 365 NU institutional Single Sign-On).
- **Serverless & Scalable:** Netlify Serverless Functions handle atomic slot validation, booking transactions, cancellation workflows, survey processing, and analytics aggregation.

---

## 🚀 Feature Highlights

### 1. Student Booking Portal (`/index.html`)
- **Institutional Email Verification:** Enforces student username input and automatically locks the institutional suffix `@students.nu-fairview.edu.ph`.
- **Student ID Validation:** Strictly validates the university Student ID format: `20XX-XXXXXX`.
- **Dynamic Slot Generation:** Calculates real-time 30-minute consultation slots based on counselor active working days, operating hours, and blocked dates.
- **Double-Booking Prevention:** Employs atomic Firestore database transactions to eliminate race conditions and double-booking.
- **Duplicate Booking Safeguard:** Prohibits a student with an active, upcoming appointment from creating multiple simultaneous bookings.
- **Sequential Confirmation Codes:** Generates human-readable reference numbers (e.g., `GCO-2026-00125`).
- **Immediate Email Confirmation:** Sends an automated email containing full appointment details and GCO consultation guidelines.

### 2. Post-Consultation Feedback Survey (`/feedback.html`)
- **One-Time Submission:** Survey links are uniquely tied to completed appointments; once submitted, the appointment is marked `hasFeedback: true` to prevent duplicate submissions.
- **5-Star Rating & Appreciation Tags:** Captures student satisfaction across key counseling metrics (Attentive Listening, Helpful Guidance, Safe & Welcoming Space, Clear Action Steps).

### 3. Counselor Dashboard & Schedule Management (`/dashboard.html`, `/schedule.html`, `/availability.html`)
- **Daily Schedule:** Live table displaying today's appointments with instant status transitions: `Completed`, `No-Show`, `Cancelled`.
- **Mandatory Cancellation Logging:** When cancelling, counselors must select a predefined cancellation reason and enter administrative remarks; the student receives an automated cancellation email.
- **Calendar & Slot Inspector:** Month calendar view highlighting appointment density with an interactive daily slot drawer.
- **Availability Management:** Counselors configure recurring weekly office hours per day and manage specific out-of-office / blocked calendar dates.

### 4. Administrator Analytics & Operations (`/admin.html`)
- **Summary Metric Cards:** Total Consultations, Completed Sessions, Cancelled Sessions, No-Show Count, and Average Student Satisfaction Rating.
- **Monthly Filter:** Toggle between specific months or "View All Time".
- **Category Frequency:** Visual breakdown of consultation categories (Academic, Career, Mental Wellness, Personal, Social, Family).
- **Program Demographics:** Consultation frequency categorized by college academic degree program.
- **Counselor Directory & Utilization:** Table displaying sessions completed, satisfaction ratings, and workload distribution.
- **Live Appointment Monitoring:** Full searchable, filterable table with CSV export functionality.
- **Staff Provisioning:** Modal interface for adding new authorized counselor accounts.

---

## 🛠 Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) | Modern, responsive, zero-framework frontend matching NU wireframe specifications |
| **Hosting & CDN** | Netlify | Global Edge CDN hosting static assets with automatic git-based continuous deployment |
| **Backend API** | Netlify Serverless Functions (Node.js 20+) | Event-driven serverless endpoints (`/api/*`) |
| **Database** | Google Cloud Firestore | High-performance, real-time NoSQL document database with ACID transactions |
| **Authentication** | Firebase Authentication | Secure staff authentication supporting Email/Password and Microsoft 365 OAuth |
| **Mailing** | Nodemailer | Transactional email delivery via SMTP or Gmail App Password |

---

## 📁 Project Directory Structure

```
GCO/
├── .env.example                     # Environment variables template
├── .gitignore                       # Safeguards secrets, node_modules, and build outputs
├── dev-server.js                    # Zero-dependency local development server
├── firestore.rules                  # Firestore role-based security rules
├── netlify.toml                     # Netlify build, redirect, and header configuration
├── package.json                     # Node.js dependencies and run scripts
├── README.md                        # Documentation & setup guide
│
├── netlify/
│   └── functions/                   # Serverless backend functions
│       ├── admin-counselors.js      # Counselor listing and account creation
│       ├── admin-stats.js           # Analytics aggregation & appointment query
│       ├── book-appointment.js     # Atomic booking transaction & confirmation mail
│       ├── get-availability.js      # Slot availability & collision computation
│       ├── submit-feedback.js       # Post-consultation survey submission
│       ├── update-appointment-status.js # Complete / No-Show / Cancel workflows
│       └── utils/
│           ├── email.js             # Nodemailer service and HTML/text templates
│           └── firebase-admin.js    # Firebase Admin SDK initialization & fallback
│
├── public/                          # Static frontend web application
│   ├── index.html                   # Student Booking Portal (Screens 1 & 2)
│   ├── feedback.html                # Student Satisfaction Survey (Screen 3)
│   ├── login.html                   # Counselor & Admin Login
│   ├── dashboard.html               # Counselor Today's Schedule & Profile
│   ├── schedule.html                # Consultation Calendar & Slot Inspector
│   ├── availability.html            # Working Hours & Blocked Dates Manager
│   ├── admin.html                   # Admin Analytics & Monitoring (Admin Screens 1 & 2)
│   ├── css/
│   │   └── base.css                 # Unified stylesheet adhering to design tokens
│   └── js/
│       ├── auth.js                  # Session state & route protection helper
│       ├── firebase-config.js       # Client Firebase SDK configuration
│       ├── booking.js               # Student booking portal controller
│       ├── feedback.js              # Feedback survey controller
│       ├── login.js                 # Login controller & OAuth handler
│       ├── dashboard.js             # Counselor dashboard controller
│       ├── schedule.js              # Calendar view controller
│       ├── availability.js          # Working hours manager controller
│       ├── admin.js                 # Admin metrics & CSV export controller
│       └── nav.js                   # Top navigation bar controller
│
└── scripts/
    ├── seed-firestore.js            # Initial database seeder script
    └── test-workflows.js            # Automated end-to-end test suite
```

---

## 🔑 Environment Variables Configuration

### Local `.env` File
Create a `.env` file in the root directory (based on `.env.example`):

```ini
# ==============================================================================
# GCOunsel Environment Variables
# ==============================================================================

# Firebase Client Configuration (Frontend)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
FIREBASE_APP_ID=your-app-id

# Firebase Admin Service Account (Backend Netlify Functions)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Email Configuration (Nodemailer - Gmail or institutional SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
FROM_EMAIL="Guidance Office <noreply@example.com>"

# Application Base URL (used in email confirmation & feedback links)
APP_BASE_URL=https://your-domain.com
```

---

### Netlify Production Environment Variables

When deploying to Netlify, configure these environment variables in the Netlify Dashboard under **Site configuration > Environment variables**:

| Variable Name | Required | Description / Example Value |
|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | **Yes** | `your-project-id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | **Yes** | `firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **Yes** | Your private key from service account JSON |
| `SMTP_HOST` | Optional | `smtp.example.com` |
| `SMTP_PORT` | Optional | `587` |
| `SMTP_SECURE` | Optional | `false` |
| `SMTP_USER` | Optional | Gmail or institutional email address |
| `SMTP_PASS` | Optional | 16-character Google App Password |
| `FROM_EMAIL` | Optional | `"Guidance Office" <noreply@example.com>` |
| `APP_BASE_URL` | **Yes** | `https://your-domain.com` |

> 💡 **Note on Firebase Client Credentials:**
> The public client credentials (`apiKey`, `projectId`, `appId`, etc.) are securely bundled in `public/js/firebase-config.js` for browser consumption, adhering to standard Firebase Web practices.

---

## 💻 Quick Start / Local Development

### 1. Prerequisites
- **Node.js**: Version 20.x or higher
- **npm**: Version 10.x or higher

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Development Server
```bash
npm run dev
```
The server will start at **`http://localhost:3000`**:
- **Student Booking Portal:** `http://localhost:3000/index.html`
- **Counselor / Admin Login:** `http://localhost:3000/login.html`
- **Netlify API Endpoints:** `http://localhost:3000/api/*`

---

## 🚢 Deployment to Netlify (GitHub CI/CD)

Because this repository is connected to Netlify, pushing changes to your GitHub branch automatically triggers a deployment:

### 1. Initialize Git & Create First Commit (if not already done)
```bash
git init
git add .
git commit -m "feat: complete GCOunsel Netlify & Firebase migration"
```

### 2. Push to GitHub
```bash
git branch -M main
git remote add origin https://github.com/YOUR_ORGANIZATION/GCO.git
git push -u origin main
```

### 3. Netlify Automatic Build
Netlify will automatically detect `netlify.toml` with the following configuration:
- **Build command:** *(none required; static files + serverless functions)*
- **Publish directory:** `public`
- **Functions directory:** `netlify/functions`

Once deployed, your live URL will be active immediately.

---

## 🧪 Automated Testing Suite

The project includes an end-to-end automated test suite verifying all project proposal constraints:

```bash
npm test
```

### Test Coverage (8/8 Passing):
1. **Input Validation:** Rejects missing student fields and non-conforming Student ID formats.
2. **Booking Submission:** Verifies successful appointment creation and confirmation email generation.
3. **Double-Booking Prevention:** Verifies that simultaneous reservation of the same counselor and slot returns `409 Conflict`.
4. **Duplicate Active Booking Safeguard:** Enforces the one-active-appointment policy per student.
5. **Real-Time Slot Engine:** Validates that booked slots are excluded from availability calculations.
6. **Status Transitions & Cancellation Reasons:** Verifies `Completed`, `No-Show`, and `Cancelled` flows along with mandatory cancellation reasons.
7. **Single-Submission Feedback:** Guarantees that satisfaction surveys can only be submitted once per appointment.
8. **Administrative Analytics:** Verifies calculation of totals, category frequencies, program distributions, and student ratings.

---

## 🔒 Security, Privacy, and Compliance

### Republic Act No. 10173 (Data Privacy Act of 2012)
- Student counseling records contain sensitive personal information.
- Appointment documents in Firestore are shielded by strict `firestore.rules`:
  - Students cannot browse or read records of other students.
  - Counselors can only access appointments assigned to their own account.
  - Full system records are restricted exclusively to authenticated administrators.

### Republic Act No. 9258 (Guidance and Counseling Act of 2004)
- Enforces strict ethical confidentiality guidelines.
- Cancellation reasons and administrative notes are protected from unauthorized disclosure.

### Student & Faculty Role Separation
- The student portal (`/index.html`) requires no login to reduce friction and encourage seeking guidance.
- The staff portal (`/login.html`) strictly denies student accounts (`@students.nu-fairview.edu.ph`) and only permits authorized faculty and guidance office personnel.
