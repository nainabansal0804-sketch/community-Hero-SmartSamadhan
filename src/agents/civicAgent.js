import { db } from "../firebase";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  addDoc, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";

// ── Haversine distance (km) ──────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Badge definitions ─────────────────────────────────────────────────
const BADGES = {
  FIRST_REPORT:    { id: "first_report",    label: "First Reporter",   emoji: "🎖️",  desc: "Submitted your first civic issue" },
  CLUSTER_HERO:    { id: "cluster_hero",    label: "Cluster Hero",     emoji: "🔥",  desc: "Your report triggered an area alert" },
  CRITICAL_SPOTTER:{ id: "critical_spotter",label: "Critical Spotter", emoji: "🚨",  desc: "Reported a Critical severity issue" },
  QUICK_5:         { id: "quick_5",         label: "Civic Champion",   emoji: "🏆",  desc: "Reported 5 civic issues" },
};

// ── Award a badge to a user ──────────────────────────────────────────
async function awardBadge(userId, badge) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  const existing = snap.data()?.badges ?? [];
  if (existing.some((b) => b.id === badge.id)) return; // already has it
  await updateDoc(userRef, {
    badges: [...existing, { ...badge, awardedAt: new Date().toISOString() }],
  });
}

// ── Check area clustering ─────────────────────────────────────────────
async function checkAreaCluster(issueId, issueData) {
  const { lat, lng, issueType } = issueData;
  const RADIUS_KM = 0.5;
  const MIN_CLUSTER = 3;

  const snap = await getDocs(
    query(collection(db, "issues"), where("issueType", "==", issueType))
  );

  const nearby = snap.docs.filter((d) => {
    if (d.id === issueId) return false;
    const { lat: la, lng: ln } = d.data();
    return la && ln && haversine(lat, lng, la, ln) < RADIUS_KM;
  });

  if (nearby.length + 1 >= MIN_CLUSTER) {
    // Create or update cluster alert
    const alertRef = collection(db, "areaAlerts");
    await addDoc(alertRef, {
      issueType,
      lat,
      lng,
      count: nearby.length + 1,
      issueIds: [issueId, ...nearby.map((d) => d.id)],
      createdAt: serverTimestamp(),
    });
    return true;
  }
  return false;
}

// ── Main agent entry point ────────────────────────────────────────────
export async function runIssueAgent(issueId, issueData, userId) {
  const tasks = [];

  // 1. Check area cluster
  tasks.push(
    checkAreaCluster(issueId, issueData).then(async (isCluster) => {
      if (isCluster) await awardBadge(userId, BADGES.CLUSTER_HERO);
    })
  );

  // 2. Award badges based on issue properties
  tasks.push(
    (async () => {
      if (issueData.severity === "Critical") {
        await awardBadge(userId, BADGES.CRITICAL_SPOTTER);
      }

      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      const reportCount = (snap.data()?.reportedIssues ?? []).length;

      if (reportCount === 1) await awardBadge(userId, BADGES.FIRST_REPORT);
      if (reportCount >= 5) await awardBadge(userId, BADGES.QUICK_5);
    })()
  );

  await Promise.allSettled(tasks);
}
