const fs = require("fs");
const path = require("path");
const os = require("os");
const admin = require("firebase-admin");

// Automatically load .env file if present
const envPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envPath);
    } else {
      const envContent = fs.readFileSync(envPath, "utf8");
      envContent.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || "").trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) process.env[key] = val;
        }
      });
    }
  } catch (e) {
    console.warn("Notice: could not load .env file:", e.message);
  }
}

let initialized = false;
let useLocalFallback = false;

const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Local persistent file store for offline/demo operation when Firebase credentials are not yet configured
const LOCAL_STORE_DIR = isServerless
  ? path.join(os.tmpdir(), "gcounsel-data")
  : path.join(__dirname, "..", "..", ".data");
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, "firestore-local.json");

function formatPrivateKey(rawKey) {
  if (!rawKey) return "";
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, "\n");
}

function ensureLocalStore() {
  if (!fs.existsSync(LOCAL_STORE_DIR)) {
    fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORE_FILE)) {
    fs.writeFileSync(
      LOCAL_STORE_FILE,
      JSON.stringify({
        counselors: {},
        appointments: {},
        feedback: {},
        counters: { appointments: { lastNumber: 125, year: 2026 } },
      }, null, 2),
      "utf8"
    );
  }
}

function readLocalStore() {
  ensureLocalStore();
  try {
    return JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, "utf8"));
  } catch (e) {
    return { counselors: {}, appointments: {}, feedback: {}, counters: {} };
  }
}

function writeLocalStore(data) {
  ensureLocalStore();
  fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

class LocalDocRef {
  constructor(collectionName, docId) {
    this.collectionName = collectionName;
    this.id = docId;
  }

  async get() {
    const store = readLocalStore();
    const data = (store[this.collectionName] || {})[this.id];
    return {
      exists: Boolean(data),
      id: this.id,
      data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
    };
  }

  async set(data) {
    const store = readLocalStore();
    if (!store[this.collectionName]) store[this.collectionName] = {};
    store[this.collectionName][this.id] = { id: this.id, ...data };
    writeLocalStore(store);
    return { id: this.id };
  }

  async update(patch) {
    const store = readLocalStore();
    if (!store[this.collectionName] || !store[this.collectionName][this.id]) {
      throw new Error(`Document ${this.id} does not exist in ${this.collectionName}`);
    }
    store[this.collectionName][this.id] = { ...store[this.collectionName][this.id], ...patch };
    writeLocalStore(store);
    return { id: this.id };
  }

  async delete() {
    const store = readLocalStore();
    if (store[this.collectionName]) {
      delete store[this.collectionName][this.id];
      writeLocalStore(store);
    }
    return { id: this.id };
  }
}

class LocalQuery {
  constructor(collectionName, filters = [], limitCount = null) {
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitCount = limitCount;
  }

  where(field, op, val) {
    return new LocalQuery(this.collectionName, [...this.filters, { field, op, val }], this.limitCount);
  }

  limit(num) {
    return new LocalQuery(this.collectionName, this.filters, num);
  }

  async get() {
    const store = readLocalStore();
    const items = Object.values(store[this.collectionName] || {});

    let filtered = items.filter((item) => {
      for (const { field, op, val } of this.filters) {
        const itemVal = item[field];
        if (op === "==" && itemVal !== val) return false;
        if (op === ">=" && !(itemVal >= val)) return false;
        if (op === "<=" && !(itemVal <= val)) return false;
        if (op === ">" && !(itemVal > val)) return false;
        if (op === "<" && !(itemVal < val)) return false;
        if (op === "in" && (!Array.isArray(val) || !val.includes(itemVal))) return false;
      }
      return true;
    });

    if (this.limitCount != null) {
      filtered = filtered.slice(0, this.limitCount);
    }

    const docs = filtered.map((item) => ({
      id: item.id,
      exists: true,
      data: () => JSON.parse(JSON.stringify(item)),
    }));

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb) => docs.forEach(cb),
    };
  }
}

class LocalFirestoreMock {
  collection(name) {
    return {
      doc: (id) => new LocalDocRef(name, id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      where: (field, op, val) => new LocalQuery(name).where(field, op, val),
      limit: (num) => new LocalQuery(name).limit(num),
      get: () => new LocalQuery(name).get(),
    };
  }

  async runTransaction(updateFunction) {
    const transaction = {
      get: async (refOrQuery) => refOrQuery.get(),
      set: (ref, data) => ref.set(data),
      update: (ref, data) => ref.update(data),
      delete: (ref) => ref.delete(),
    };
    return updateFunction(transaction);
  }
}

function initFirebaseAdmin() {
  if (initialized) return admin;

  const hasCredentials =
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT) ||
    Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PRIVATE_KEY) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!hasCredentials) {
    if (isServerless) {
      console.error("Missing Firebase Admin credentials on server! Available keys:", Object.keys(process.env).filter(k => k.includes("FIREBASE")));
      throw new Error("Missing Firebase Admin credentials on server. Please verify FIREBASE_ADMIN_PROJECT_ID and FIREBASE_ADMIN_PRIVATE_KEY in Netlify.");
    }
    useLocalFallback = true;
    initialized = true;
    return admin;
  }

  try {
    const { initializeApp, cert, getApps } = require("firebase-admin/app");

    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({ credential: cert(serviceAccount) });
      } else if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
      } else {
        initializeApp();
      }
    }
    initialized = true;
  } catch (error) {
    console.error("Firebase Admin initialization error:", error.message);
    if (isServerless) {
      throw new Error("Firebase Admin failed to connect to Cloud: " + error.message);
    }
    useLocalFallback = true;
    initialized = true;
  }

  return admin;
}

function getDb() {
  initFirebaseAdmin();
  if (useLocalFallback) {
    return new LocalFirestoreMock();
  }
  try {
    const { getFirestore } = require("firebase-admin/firestore");
    return getFirestore();
  } catch (e) {
    if (isServerless) throw e;
    return new LocalFirestoreMock();
  }
}

function getAuth() {
  initFirebaseAdmin();
  if (useLocalFallback) {
    return {
      createUser: async ({ email, displayName }) => ({
        uid: `counselor_${Date.now()}`,
        email,
        displayName,
      }),
    };
  }
  try {
    const { getAuth } = require("firebase-admin/auth");
    return getAuth();
  } catch (e) {
    if (isServerless) throw e;
    return {
      createUser: async ({ email, displayName }) => ({
        uid: `counselor_${Date.now()}`,
        email,
        displayName,
      }),
    };
  }
}

module.exports = {
  admin,
  initFirebaseAdmin,
  getDb,
  getAuth,
  readLocalStore,
  writeLocalStore,
};
