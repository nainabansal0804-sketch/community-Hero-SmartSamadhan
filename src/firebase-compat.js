 import { initializeApp as realInitializeApp } from "@firebase/app";
import { 
  getAuth as realGetAuth, 
  GoogleAuthProvider as realGoogleAuthProvider,
  onAuthStateChanged as realOnAuthStateChanged,
  signInWithPopup as realSignInWithPopup,
  signOut as realSignOut,
  updateProfile as realUpdateProfile
} from "@firebase/auth";
import {
  getFirestore as realGetFirestore,
  collection as realCollection,
  doc as realDoc,
  addDoc as realAddDoc,
  setDoc as realSetDoc,
  updateDoc as realUpdateDoc,
  getDoc as realGetDoc,
  getDocs as realGetDocs,
  query as realQuery,
  where as realWhere,
  orderBy as realOrderBy,
  limit as realLimit,
  onSnapshot as realOnSnapshot,
  arrayUnion as realArrayUnion,
  arrayRemove as realArrayRemove,
  serverTimestamp as realServerTimestamp,
  increment as realIncrement
} from "@firebase/firestore";

// Check if we have a valid, non-placeholder API key
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isConfigValid = !!(
  apiKey && 
  apiKey.length > 10 && 
  apiKey !== "MY_FIREBASE_API_KEY" && 
  apiKey !== "YOUR_API_KEY" && 
  !apiKey.toLowerCase().includes("placeholder")
);

console.log(`[SmartSamadhan Firebase] Config verification: isConfigValid=${isConfigValid}`);

let realApp = null;
let realAuthInstance = null;
let realDbInstance = null;

let useMockSystem = !isConfigValid;

// Unified Auth State
const authListeners = new Set();
let currentAuthUser = null;

try {
  const savedUser = localStorage.getItem("SmartSamadhan_user");
  if (savedUser) {
    currentAuthUser = JSON.parse(savedUser);
  }
} catch (e) {
  // ignore
}

function updateAuthUser(user) {
  currentAuthUser = user;
  if (mockAuthInstance) {
    mockAuthInstance.currentUser = user;
  }
  if (user) {
    localStorage.setItem("SmartSamadhan_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("SmartSamadhan_user");
  }
  authListeners.forEach((callback) => {
    try {
      callback(user);
    } catch (err) {
      console.error("[SmartSamadhan Firebase] Error in auth listener callback:", err);
    }
  });
}

// Switching to mock seamlessly
function switchToMock(reason) {
  if (!useMockSystem) {
    console.warn(`[SmartSamadhan Firebase] Switching to local MOCK storage because: ${reason}`);
    useMockSystem = true;
    try {
      const savedUser = localStorage.getItem("SmartSamadhan_user");
      updateAuthUser(savedUser ? JSON.parse(savedUser) : null);
    } catch (e) {
      updateAuthUser(null);
    }
  }
}

// Global Exception Handlers to catch Firebase Errors anywhere (e.g. invalid API key asynchronous rejection)
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reasonStr = event.reason ? String(event.reason) : "";
    if (
      reasonStr.includes("FirebaseError") || 
      reasonStr.includes("auth/invalid-api-key") || 
      reasonStr.includes("API key") || 
      reasonStr.includes("apiKey")
    ) {
      event.preventDefault(); // Prevent crash/ugly console red log
      switchToMock(`unhandled promise rejection [${reasonStr}]`);
    }
  });

  window.addEventListener("error", (event) => {
    const errStr = event.error ? String(event.error) : "";
    if (
      errStr.includes("FirebaseError") || 
      errStr.includes("auth/invalid-api-key") || 
      errStr.includes("API key") || 
      errStr.includes("apiKey")
    ) {
      event.preventDefault();
      switchToMock(`unhandled window error [${errStr}]`);
    }
  });
}

if (isConfigValid) {
  try {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    realApp = realInitializeApp(firebaseConfig);
    realAuthInstance = realGetAuth(realApp);
    realDbInstance = realGetFirestore(realApp);

    // Set up real listener to sync with unified state
    realOnAuthStateChanged(realAuthInstance, (user) => {
      if (!useMockSystem) {
        updateAuthUser(user);
      }
    }, (err) => {
      console.warn("[SmartSamadhan Firebase] Real onAuthStateChanged error, switching to mock:", err);
      switchToMock(err.message || "Auth listener error");
    });
  } catch (err) {
    console.error("Failed to initialize real Firebase — falling back to mock:", err);
    useMockSystem = true;
  }
}

// ── MOCK SYSTEM ──────────────────────────────────────────────────────────

class MockAuth {
  constructor() {
    this.listeners = [];
    const savedUser = localStorage.getItem("SmartSamadhan_user");
    this.currentUser = savedUser ? JSON.parse(savedUser) : null;
  }
  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  setCurrentUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem("SmartSamadhan_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("SmartSamadhan_user");
    }
    this.listeners.forEach(l => l(user));
  }
}

const mockAuthInstance = new MockAuth();

class MockFirestore {
  constructor() {
    this.listeners = [];
    this.initSeed();
  }

  initSeed() {
    if (!localStorage.getItem("SmartSamadhan_issues")) {
      const initialIssues = [
        {
          id: "issue-1",
          title: "Major Pothole on Ring Road",
          issueType: "Pothole",
          description: "Large pothole causing traffic slowdowns near the main flyover crossing.",
          severity: "High",
          department: "PWD",
          status: "In Progress",
          lat: 28.6139,
          lng: 77.2090,
          reporterName: "Rohan Sharma",
          reporterUid: "reporter-1",
          upvotes: ["user-2", "user-3"],
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          urgencyReason: "Highly hazardous for two-wheelers at night.",
        },
        {
          id: "issue-2",
          title: "Garbage Overflow near Central Market",
          issueType: "Garbage Overflow",
          description: "Municipal bins are overflowing. Severe odor and street dogs gathering around the area.",
          severity: "Critical",
          department: "Sanitation Department",
          status: "Reported",
          lat: 28.6250,
          lng: 77.2200,
          reporterName: "Priya Patel",
          reporterUid: "reporter-2",
          upvotes: ["user-1"],
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          urgencyReason: "Attracting pests near high-footfall marketplace.",
        },
        {
          id: "issue-3",
          title: "Broken Streetlight on 5th Avenue",
          issueType: "Broken Streetlight",
          description: "Streetlight has been flickering and completely blacked out for the last 3 days.",
          severity: "Medium",
          department: "Electricity Board",
          status: "Resolved",
          lat: 28.6012,
          lng: 77.1950,
          reporterName: "Aman Verma",
          reporterUid: "reporter-3",
          upvotes: [],
          createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          urgencyReason: "Area is pitch dark, making residents feel unsafe during evening walks.",
        }
      ];
      localStorage.setItem("SmartSamadhan_issues", JSON.stringify(initialIssues));
    }
  }

  getCollection(name) {
    try {
      return JSON.parse(localStorage.getItem(`SmartSamadhan_${name}`) || "[]");
    } catch {
      return [];
    }
  }

  saveCollection(name, data) {
    localStorage.setItem(`SmartSamadhan_${name}`, JSON.stringify(data));
    this.listeners.forEach(l => {
      if (l.collectionName === name) {
        if (l.isDocListener) {
          const found = data.find(item => item.id === l.docId);
          l.callback({
            id: l.docId,
            exists: () => found !== undefined,
            data: () => found,
          });
        } else {
          l.callback(this.getQuerySnapshot(name, l.queryObj));
        }
      }
    });
  }

  getQuerySnapshot(collectionName, queryObj) {
    let items = this.getCollection(collectionName);
    
    if (queryObj && queryObj.filters) {
      for (const filter of queryObj.filters) {
        const { field, op, value } = filter;
        items = items.filter(item => {
          if (op === "==") return item[field] === value;
          if (op === "array-contains") return Array.isArray(item[field]) && item[field].includes(value);
          return true;
        });
      }
    }

    if (queryObj && queryObj.orderByField) {
      const field = queryObj.orderByField;
      const desc = queryObj.orderByDirection === "desc";
      items.sort((a, b) => {
        const valA = a[field] || "";
        const valB = b[field] || "";
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    }

    if (queryObj && queryObj.limitVal !== undefined) {
      items = items.slice(0, queryObj.limitVal);
    }

    return {
      docs: items.map(item => ({
        id: item.id,
        data: () => item,
        exists: () => true,
      })),
      empty: items.length === 0,
      size: items.length,
    };
  }

  addListener(collectionName, queryObj, callback) {
    const listener = { collectionName, queryObj, callback };
    this.listeners.push(listener);
    setTimeout(() => {
      callback(this.getQuerySnapshot(collectionName, queryObj));
    }, 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  addDocListener(collectionName, docId, callback) {
    const listener = { collectionName, docId, callback, isDocListener: true };
    this.listeners.push(listener);
    setTimeout(() => {
      const items = this.getCollection(collectionName);
      const found = items.find(item => item.id === docId);
      callback({
        id: docId,
        exists: () => found !== undefined,
        data: () => found,
      });
    }, 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

const mockDbInstance = new MockFirestore();

// ── EXPORTED INITIALIZERS ───────────────────────────────────────────────

export function initializeApp() {
  return useMockSystem ? {} : (realApp || {});
}

export function getAuth() {
  return useMockSystem ? mockAuthInstance : (realAuthInstance || mockAuthInstance);
}

export function getFirestore() {
  return useMockSystem ? mockDbInstance : (realDbInstance || mockDbInstance);
}

export const GoogleAuthProvider = isConfigValid ? realGoogleAuthProvider : class {
  static PROVIDER_ID = "google.com";
};

// ── EXPORTED AUTH FUNCTIONS ─────────────────────────────────────────────

export function onAuthStateChanged(authRef, callback) {
  authListeners.add(callback);
  // Trigger callback immediately on next tick with current value
  setTimeout(() => {
    if (authListeners.has(callback)) {
      callback(currentAuthUser);
    }
  }, 0);

  return () => {
    authListeners.delete(callback);
  };
}

export function isUsingMock() {
  return useMockSystem;
}

export function forceMockSystem() {
  switchToMock("User requested mock mode override");
}

export async function signInWithDemo() {
  console.log("[SmartSamadhan Firebase] Using mock user...");
  const dummyUser = {
    uid: "mock-citizen-101",
    displayName: "Jane Doe (Preview Mode)",
    email: "jane.doe@example.com",
    photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=Jane",
    emailVerified: true,
  };
  updateAuthUser(dummyUser);
  return { user: dummyUser };
}

export async function signInWithPopup(authRef, providerRef) {
  console.log("[SmartSamadhan Firebase] signInWithPopup called", { useMockSystem });
  if (!useMockSystem && authRef && authRef !== mockAuthInstance) {
    try {
      console.log("[SmartSamadhan Firebase] Attempting real signInWithPopup...");
      const result = await realSignInWithPopup(authRef, providerRef);
      console.log("[SmartSamadhan Firebase] Real signInWithPopup succeeded!");
      if (result && result.user) {
        updateAuthUser(result.user);
      }
      return result;
    } catch (err) {
      console.error("[SmartSamadhan Firebase] Real signInWithPopup failed:", err);
      throw err;
    }
  }
  
  return signInWithDemo();
}

export async function signOut(authRef) {
  if (!useMockSystem && authRef && authRef !== mockAuthInstance) {
    try {
      await realSignOut(authRef);
    } catch (err) {
      console.error("[SmartSamadhan Firebase] Real signOut failed:", err);
    }
  }
  updateAuthUser(null);
}

export async function updateProfile(userRef, profileData) {
  if (!useMockSystem && userRef) {
    try {
      await realUpdateProfile(userRef, profileData);
      if (realAuthInstance && realAuthInstance.currentUser) {
        updateAuthUser(realAuthInstance.currentUser);
      }
      return;
    } catch (err) {
      console.error("[SmartSamadhan Firebase] Real updateProfile failed, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  if (currentAuthUser) {
    const updated = { ...currentAuthUser, ...profileData };
    updateAuthUser(updated);
  }
}

// ── EXPORTED FIRESTORE FUNCTIONS ────────────────────────────────────────

export function collection(dbRef, name) {
  if (!useMockSystem && dbRef && !(dbRef instanceof MockFirestore)) {
    try {
      return realCollection(dbRef, name);
    } catch (err) {
      console.error("Error in realCollection, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  return { _type: "collection", name };
}

export function doc(dbRef, collectionName, docId) {
  if (!useMockSystem && dbRef && !(dbRef instanceof MockFirestore)) {
    try {
      return realDoc(dbRef, collectionName, docId);
    } catch (err) {
      console.error("Error in realDoc, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  if (typeof dbRef === "string") {
    return { _type: "doc", collectionName: dbRef, docId: collectionName };
  }
  return { _type: "doc", collectionName: collectionName.name || collectionName, docId };
}

export function query(colRef, ...constraints) {
  if (!useMockSystem && colRef && colRef._type !== "collection") {
    try {
      return realQuery(colRef, ...constraints);
    } catch (err) {
      console.error("Error in realQuery, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  const queryObj = {
    collectionName: colRef.name,
    filters: [],
    orderByField: null,
    orderByDirection: "asc",
    limitVal: undefined,
  };
  for (const c of constraints) {
    if (c._type === "where") {
      queryObj.filters.push({ field: c.field, op: c.op, value: c.value });
    } else if (c._type === "orderBy") {
      queryObj.orderByField = c.field;
      queryObj.orderByDirection = c.direction || "asc";
    } else if (c._type === "limit") {
      queryObj.limitVal = c.value;
    }
  }
  return { _type: "query", colRef, queryObj };
}

export function where(field, op, value) {
  if (!useMockSystem) {
    try {
      return realWhere(field, op, value);
    } catch (err) {
      // Ignore
    }
  }
  return { _type: "where", field, op, value };
}

export function orderBy(field, direction = "asc") {
  if (!useMockSystem) {
    try {
      return realOrderBy(field, direction);
    } catch (err) {
      // Ignore
    }
  }
  return { _type: "orderBy", field, direction };
}

export function limit(value) {
  if (!useMockSystem) {
    try {
      return realLimit(value);
    } catch (err) {
      // Ignore
    }
  }
  return { _type: "limit", value };
}

function getTargetInfo(target) {
  if (!target) return null;
  
  if (target._type === "doc") {
    return { type: "doc", collectionName: target.collectionName, docId: target.docId };
  }
  if (target._type === "collection") {
    return { type: "collection", collectionName: target.name, queryObj: null };
  }
  if (target._type === "query") {
    return { type: "collection", collectionName: target.colRef.name, queryObj: target.queryObj };
  }

  // Real Firebase references
  if (target.path) {
    const parts = target.path.split("/");
    if (parts.length === 2) {
      return { type: "doc", collectionName: parts[0], docId: parts[1] };
    } else {
      return { type: "collection", collectionName: parts[0], queryObj: null };
    }
  }

  if (target._query && target._query.path) {
    const path = target._query.path.segments.join("/");
    return { type: "collection", collectionName: path, queryObj: null };
  }

  return null;
}

export function onSnapshot(target, callback, errorCallback) {
  if (!useMockSystem && target && target._type !== "query" && target._type !== "collection" && target._type !== "doc") {
    try {
      return realOnSnapshot(target, callback, (err) => {
        console.error("Firestore onSnapshot error, switching to mock:", err);
        switchToMock(err.message || "onSnapshot error");
        // Re-subscribe callback to mock
        onSnapshot(target, callback, errorCallback);
      });
    } catch (err) {
      console.error("Error in realOnSnapshot, falling back to mock:", err);
      switchToMock(err.message);
    }
  }

  const info = getTargetInfo(target);
  if (info) {
    if (info.type === "doc") {
      return mockDbInstance.addDocListener(info.collectionName, info.docId, callback);
    } else {
      return mockDbInstance.addListener(info.collectionName, info.queryObj, callback);
    }
  }

  const colName = target && target.colRef ? target.colRef.name : (target && target.name || "");
  const queryObj = (target && target.queryObj) || null;
  return mockDbInstance.addListener(colName, queryObj, callback);
}

export async function getDocs(target) {
  if (!useMockSystem && target && target._type !== "query" && target._type !== "collection" && target._type !== "doc") {
    try {
      return await realGetDocs(target);
    } catch (err) {
      console.error("Error in realGetDocs, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  const info = getTargetInfo(target);
  const colName = info ? info.collectionName : (target && target.colRef ? target.colRef.name : (target && target.name || ""));
  const queryObj = info ? info.queryObj : (target && target.queryObj || null);
  return mockDbInstance.getQuerySnapshot(colName, queryObj);
}

export async function getDoc(docRef) {
  if (!useMockSystem && docRef && docRef._type !== "doc") {
    try {
      return await realGetDoc(docRef);
    } catch (err) {
      console.error("Error in realGetDoc, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  const info = getTargetInfo(docRef);
  const colName = info ? info.collectionName : (docRef && docRef.collectionName || "");
  const docId = info ? info.docId : (docRef && docRef.docId || "");
  const items = mockDbInstance.getCollection(colName);
  const found = items.find(item => item.id === docId);
  return {
    id: docId,
    data: () => found,
    exists: () => found !== undefined,
  };
}

function resolveMockValue(val, currentFieldVal = 0) {
  if (val && typeof val === "object") {
    if (val._serverTimestamp) {
      return new Date().toISOString();
    }
    if (val._increment !== undefined) {
      const current = typeof currentFieldVal === "number" ? currentFieldVal : 0;
      return current + val._increment;
    }
  }
  return val;
}

export async function addDoc(colRef, data) {
  if (!useMockSystem && colRef && colRef._type !== "collection") {
    try {
      return await realAddDoc(colRef, data);
    } catch (err) {
      console.error("Error in realAddDoc, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  const items = mockDbInstance.getCollection(colRef.name);
  const processedData = {};
  for (const key of Object.keys(data)) {
    processedData[key] = resolveMockValue(data[key]);
  }
  const newDoc = {
    id: "doc_" + Math.random().toString(36).substring(2, 11),
    ...processedData,
    createdAt: processedData.createdAt || new Date().toISOString(),
  };
  items.push(newDoc);
  mockDbInstance.saveCollection(colRef.name, items);
  return { id: newDoc.id };
}

export async function setDoc(docRef, data, options) {
  if (!useMockSystem && docRef && docRef._type !== "doc") {
    try {
      return await realSetDoc(docRef, data, options);
    } catch (err) {
      console.error("Error in realSetDoc, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  const items = mockDbInstance.getCollection(docRef.collectionName);
  const index = items.findIndex(item => item.id === docRef.docId);
  const existing = index !== -1 ? items[index] : {};
  
  const processedData = {};
  for (const key of Object.keys(data)) {
    processedData[key] = resolveMockValue(data[key], existing[key]);
  }

  if (index !== -1) {
    if (options && options.merge) {
      items[index] = { ...existing, ...processedData };
    } else {
      items[index] = { id: docRef.docId, ...processedData };
    }
  } else {
    items.push({ id: docRef.docId, ...processedData });
  }
  mockDbInstance.saveCollection(docRef.collectionName, items);
}

export async function updateDoc(docRef, data) {
  if (!useMockSystem && docRef && docRef._type !== "doc") {
    try {
      return await realUpdateDoc(docRef, data);
    } catch (err) {
      console.error("Error in realUpdateDoc, falling back to mock:", err);
      switchToMock(err.message);
    }
  }
  const items = mockDbInstance.getCollection(docRef.collectionName);
  const index = items.findIndex(item => item.id === docRef.docId);
  if (index !== -1) {
    const current = { ...items[index] };
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val && typeof val === "object" && val._arrayUnion) {
        const arr = Array.isArray(current[key]) ? [...current[key]] : [];
        for (const el of val._arrayUnion) {
          if (!arr.includes(el)) arr.push(el);
        }
        current[key] = arr;
      } else if (val && typeof val === "object" && val._arrayRemove) {
        const arr = Array.isArray(current[key]) ? [...current[key]] : [];
        current[key] = arr.filter(el => !val._arrayRemove.includes(el));
      } else {
        current[key] = resolveMockValue(val, current[key]);
      }
    }
    items[index] = current;
    mockDbInstance.saveCollection(docRef.collectionName, items);
  } else {
    throw new Error("Document not found");
  }
}

export function arrayUnion(...elements) {
  if (!useMockSystem) {
    try {
      return realArrayUnion(...elements);
    } catch (err) {
      // Ignore
    }
  }
  return { _arrayUnion: elements };
}

export function arrayRemove(...elements) {
  if (!useMockSystem) {
    try {
      return realArrayRemove(...elements);
    } catch (err) {
      // Ignore
    }
  }
  return { _arrayRemove: elements };
}

export function serverTimestamp() {
  if (!useMockSystem) {
    try {
      return realServerTimestamp();
    } catch (err) {
      // Ignore
    }
  }
  return { _serverTimestamp: true };
}

export function increment(value) {
  if (!useMockSystem) {
    try {
      return realIncrement(value);
    } catch (err) {
      // Ignore
    }
  }
  return { _increment: value };
}
