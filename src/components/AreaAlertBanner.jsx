import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export default function AreaAlertBanner() {
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "areaAlerts"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setAlert({ id: snap.docs[0].id, ...snap.docs[0].data() });
      else setAlert(null);
    });
    return unsub;
  }, []);

  if (!alert) return null;

  return (
    <div className="bg-[#fff7ed] border-b border-[#ffedd5] px-4 py-2 flex items-center gap-2 text-[13px] font-semibold text-[#c2410c]">
      <span className="material-symbols-outlined" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>warning</span>
      🔥 Area Alert: {alert.count} {alert.issueType} reports within 500m — possible hotspot!
    </div>
  );
}
