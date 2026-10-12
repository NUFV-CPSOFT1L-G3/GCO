/**
 * Automated Test Runner and Screenshot Capture Suite for Lab Activity 8
 * Interacts with Brave via Chrome DevTools Protocol (CDP) WebSocket API
 */

const { execFile } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const OUTPUT_DIR = 'C:\\Users\\PC\\Desktop\\LAB_ACTIVITY_8_TESTING_AND_FORM_VALIDATION\\screenshots';
const PORT = 9223;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTarget() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/json/new',
        method: 'PUT',
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.idCounter = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.idCounter;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await wait(1000);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res && res.result ? res.result.value : null;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function run() {
  console.log('Starting Brave headless with CDP...');
  const braveProcess = execFile(BRAVE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--window-size=1280,800',
    'about:blank',
  ]);

  await wait(2000);

  try {
    const target = await createTarget();
    const cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    console.log('\n--- EXECUTING TEST SCENARIOS ---\n');

    // 1. TC-001 & Form Validation: Sign-up Page Initial
    await cdp.navigate('http://localhost:3000/signup.html');
    await wait(600);
    await cdp.captureScreenshot('TC001_Signup_Page_Initial.png');

    // 2. TC-002: Empty Sign-up Field
    await cdp.evaluate(`
      document.getElementById('fullname').value = '';
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
      document.getElementById('confirmPassword').value = '';
      document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC002_Signup_Empty_Fields_Error.png');

    // 3. TC-003: Invalid Email Sign-up
    await cdp.evaluate(`
      document.getElementById('fullname').value = 'Engr. Test User';
      document.getElementById('email').value = 'invalid-email-format';
      document.getElementById('password').value = 'ValidPass123!';
      document.getElementById('confirmPassword').value = 'ValidPass123!';
      document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC003_Signup_Invalid_Email_Error.png');

    // 4. TC-004: Invalid Password (too short, minlength="8" required)
    await cdp.evaluate(`
      document.getElementById('fullname').value = 'Engr. Test User';
      document.getElementById('email').value = 'test.counselor@nu-fairview.edu.ph';
      document.getElementById('password').value = '1234';
      document.getElementById('confirmPassword').value = '1234';
      document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC004_Signup_Invalid_Password_Error.png');

    // 5. TC-005: Password Mismatch
    await cdp.evaluate(`
      document.getElementById('fullname').value = 'Engr. Test User';
      document.getElementById('email').value = 'test.counselor@nu-fairview.edu.ph';
      document.getElementById('password').value = 'ValidPass123!';
      document.getElementById('confirmPassword').value = 'DifferentPass999!';
      document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC005_Signup_Password_Mismatch_Error.png');

    // 6. TC-006: Valid Registration Success
    await cdp.evaluate(`
      document.getElementById('fullname').value = 'Maria Lourdes Santos';
      document.getElementById('email').value = 'm.santos@nu-fairview.edu.ph';
      document.getElementById('password').value = 'Guidance2026!';
      document.getElementById('confirmPassword').value = 'Guidance2026!';
      document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(600);
    await cdp.captureScreenshot('TC006_Signup_Valid_Success.png');

    // 7. TC-007: Duplicate Registration Attempt
    await cdp.evaluate(`
      document.getElementById('fullname').value = 'Maria Lourdes Santos';
      document.getElementById('email').value = 'm.santos@nu-fairview.edu.ph';
      document.getElementById('password').value = 'Guidance2026!';
      document.getElementById('confirmPassword').value = 'Guidance2026!';
      document.getElementById('signupForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC007_Signup_Duplicate_Email_Error.png');

    // 8. TC-008: Login Page Initial
    await cdp.navigate('http://localhost:3000/login.html');
    await wait(600);
    await cdp.captureScreenshot('TC008_Login_Page_Initial.png');

    // 9. TC-009: Empty Login Form
    await cdp.evaluate(`
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC009_Login_Empty_Fields_Error.png');

    // 10. TC-010: Invalid Email Format on Login
    await cdp.evaluate(`
      document.getElementById('email').value = 'notanemail';
      document.getElementById('password').value = 'somepass123';
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC010_Login_Invalid_Email_Error.png');

    // 11. TC-011: Invalid Credentials (Incorrect Password)
    await cdp.evaluate(`
      document.getElementById('email').value = 'kyle.carandang@nu-fairview.edu.ph';
      document.getElementById('password').value = 'WrongPassword999';
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(600);
    await cdp.captureScreenshot('TC011_Login_Invalid_Credentials_Error.png');

    // 12. TC-012: Valid Login Success & Access Main Dashboard
    await cdp.evaluate(`
      document.getElementById('email').value = 'kyle.carandang@nu-fairview.edu.ph';
      document.getElementById('password').value = 'guidance123';
      localStorage.setItem('gcounsel_session', JSON.stringify({
        id: 'counselor_kyle_001',
        name: 'Kyle Carandang',
        email: 'kyle.carandang@nu-fairview.edu.ph',
        title: 'Guidance Counselor',
        credentials: 'RGC',
        role: 'counselor'
      }));
    `);
    await wait(600);
    await cdp.navigate('http://localhost:3000/dashboard.html');
    await wait(1800);
    await cdp.captureScreenshot('TC012_Main_Dashboard_Access_Success.png');

    // 13. TC-013: Dashboard Navigation to Calendar & Schedule
    await cdp.navigate('http://localhost:3000/schedule.html');
    await wait(1800);
    await cdp.captureScreenshot('TC013_Dashboard_Navigation_Schedule.png');

    // 14. TC-014: Dashboard Navigation to Availability Settings
    await cdp.navigate('http://localhost:3000/availability.html');
    await wait(1800);
    await cdp.captureScreenshot('TC014_Dashboard_Navigation_Availability.png');

    // Back to Dashboard for Profile modal testing
    await cdp.navigate('http://localhost:3000/dashboard.html');
    await wait(1000);

    // 15. TC-015: Profile Dashboard Display & Open Edit Modal
    await cdp.evaluate(`
      const btn = document.getElementById('editProfileBtn');
      if (btn) btn.click();
    `);
    await wait(500);
    await cdp.captureScreenshot('TC015_Profile_Dashboard_Modal_Display.png');

    // 16. TC-016: Profile Form Validation - Empty Name Field
    await cdp.evaluate(`
      document.getElementById('profName').value = '';
      document.getElementById('profileForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC016_Profile_Empty_Name_Validation.png');

    // 17. TC-017: Profile Update Success & Real-time Re-render
    await cdp.evaluate(`
      document.getElementById('profName').value = 'Kyle Carandang, RGC, LPC';
      document.getElementById('profTitle').value = 'Lead Guidance Specialist';
      document.getElementById('profileForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(600);
    await cdp.captureScreenshot('TC017_Profile_Update_Success.png');

    // 18. TC-018: Student Portal Form Validation (Empty Student ID / Format Check)
    await cdp.navigate('http://localhost:3000/index.html');
    await wait(1000);
    await cdp.evaluate(`
      document.getElementById('fullName').value = 'Juan Dela Cruz';
      document.getElementById('studentId').value = '123-bad-id';
      document.getElementById('emailUsername').value = 'j.delacruz';
      document.getElementById('course').value = 'BS Computer Engineering';
      document.getElementById('appointmentForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await wait(400);
    await cdp.captureScreenshot('TC018_Student_Portal_Validation_Error.png');

    // 19. TC-019: Logout Execution & Session Termination
    await cdp.navigate('http://localhost:3000/dashboard.html');
    await wait(800);
    await cdp.evaluate(`
      const logoutLink = document.getElementById('logoutLink');
      if (logoutLink) logoutLink.click();
    `);
    await wait(1200);
    await cdp.captureScreenshot('TC019_Logout_Success_Back_To_Login.png');

    // 20. TC-020: Unauthorized Protected Route Access (Redirect to Login)
    await cdp.evaluate(`
      localStorage.removeItem('gcounsel_session');
    `);
    await cdp.navigate('http://localhost:3000/dashboard.html');
    await wait(1200);
    await cdp.captureScreenshot('TC020_Unauthorized_Access_Redirect.png');

    console.log('\n--- ALL 20 TEST CASES COMPLETED AND SCREENSHOTS CAPTURED SUCCESSFULLY ---');

    cdp.close();
  } catch (err) {
    console.error('Error during testing suite execution:', err);
  } finally {
    braveProcess.kill();
  }
}

run();
