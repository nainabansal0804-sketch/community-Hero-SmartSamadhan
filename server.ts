import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Initialize Google Gen AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("[WARNING] GEMINI_API_KEY not set — AI endpoints will fail gracefully.");
}

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// MODEL CONFIGURATION
const MODEL = "gemini-3.5-flash";

const VALID_ISSUE_TYPES = new Set([
  "Pothole",
  "Broken Streetlight",
  "Water Leakage",
  "Garbage Overflow",
  "Damaged Road",
  "Open Drain",
  "Other",
]);
const VALID_SEVERITIES = new Set(["Low", "Medium", "High", "Critical"]);
const VALID_DEPARTMENTS = new Set([
  "PWD",
  "Municipal Corporation",
  "Electricity Board",
  "Water Board",
  "Sanitation Department",
  "General Admin",
]);

const RESOLUTION_DAYS: Record<string, number> = {
  "Pothole_Critical": 3,
  "Pothole_High": 7,
  "Pothole_Medium": 14,
  "Pothole_Low": 21,
  "Broken Streetlight_Critical": 2,
  "Broken Streetlight_High": 5,
  "Broken Streetlight_Medium": 10,
  "Broken Streetlight_Low": 15,
  "Garbage Overflow_Critical": 1,
  "Garbage Overflow_High": 3,
  "Garbage Overflow_Medium": 7,
  "Garbage Overflow_Low": 10,
  "Water Leakage_Critical": 2,
  "Water Leakage_High": 5,
  "Water Leakage_Medium": 10,
  "Water Leakage_Low": 14,
  "Open Drain_Critical": 3,
  "Open Drain_High": 7,
  "Open Drain_Medium": 14,
  "Open Drain_Low": 21,
  "Damaged Road_Critical": 3,
  "Damaged Road_High": 7,
  "Damaged Road_Medium": 14,
  "Damaged Road_Low": 21,
  "Other_Critical": 5,
  "Other_High": 10,
  "Other_Medium": 15,
  "Other_Low": 21,
};

const DEPT_BASE_DAYS: Record<string, number> = {
  PWD: 14,
  "Municipal Corporation": 10,
  "Electricity Board": 7,
  "Water Board": 5,
  "Sanitation Department": 3,
  "General Admin": 10,
};

const SEVERITY_MULTIPLIER: Record<string, number> = {
  Critical: 0.3,
  High: 0.6,
  Medium: 1.0,
  Low: 1.5,
};

function cleanJson(text: string): string {
  text = text.trim();
  if (text.includes("```")) {
    const parts = text.split("```");
    for (let part of parts) {
      part = part.trim();
      if (part.startsWith("json")) {
        part = part.substring(4).trim();
      }
      if (part.startsWith("{")) {
        return part;
      }
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start !== -1 && end > start) {
    return text.substring(start, end);
  }
  return text;
}

function normalizeConfidence(val: any): number {
  try {
    const v = parseFloat(String(val).replace("%", "").trim());
    return Number((v > 1.0 ? v / 100.0 : v).toFixed(2));
  } catch {
    return 0.8;
  }
}

function sanitizeAiResult(result: any): any {
  let issueType = result.issueType || "Other";
  if (!VALID_ISSUE_TYPES.has(issueType)) {
    issueType = "Other";
  }

  let severity = result.severity || "Medium";
  if (!VALID_SEVERITIES.has(severity)) {
    severity = "Medium";
  }

  let department = result.department || "Municipal Corporation";
  if (!VALID_DEPARTMENTS.has(department)) {
    department = "Municipal Corporation";
  }

  const description = String(result.description || "Civic issue detected.").substring(0, 500);
  const urgencyReason = String(result.urgencyReason || "Requires prompt attention.").substring(0, 300);
  const confidence = normalizeConfidence(result.confidence || 0.8);
  const isValidCivicIssue = result.isValidCivicIssue !== undefined ? !!result.isValidCivicIssue : true;
  const invalidReason = String(result.invalidReason || "").substring(0, 300);

  return {
    issueType,
    severity,
    department,
    description,
    confidence,
    urgencyReason,
    isValidCivicIssue,
    invalidReason,
  };
}

// ── API ROUTES ───────────────────────────────────────────────────────────

// Root check
app.get("/api-status", (req, res) => {
  res.json({ status: "SmartSamadhan API running", model: MODEL, version: "1.0.0" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    models_cascade: [MODEL],
    ai_key: GEMINI_API_KEY ? "configured" : "missing",
    timestamp: Date.now() / 1000,
  });
});

// Analyze issue
app.post("/analyze-issue", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ detail: "No image file uploaded." });
    }

    const lat = req.body.lat || "28.6139";
    const lng = req.body.lng || "77.2090";

    if (!ai) {
      return res.status(503).json({ detail: "AI service not configured. GEMINI_API_KEY missing." });
    }

    const imagePart = {
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype || "image/jpeg",
      },
    };

    const promptText = `You are an expert civic issue classifier.
First, determine if the uploaded image actually depicts a public/outdoor civic, environmental, or community infrastructure issue (such as potholes, broken lights, trash dumps, open drains, damaged roads, water leaks, public property damage, etc.). 
If it is unrelated, random, or inappropriate (such as a selfie/person, domestic pets, plates of food, receipts/documents, clean indoor house rooms, internet memes, abstract art, or product listings), you MUST mark it as invalid.

Return ONLY valid JSON (no markdown, no backticks, no extra text):
{
  "isValidCivicIssue": true_or_false,
  "invalidReason": "If isValidCivicIssue is false, write a polite, friendly, helpful 1-2 sentence explanation explaining what was detected instead of a civic issue and gently requesting they upload a valid image of a street problem. Leave empty if valid.",
  "issueType": "one of: Pothole, Broken Streetlight, Water Leakage, Garbage Overflow, Damaged Road, Open Drain, Other",
  "severity": "one of: Low, Medium, High, Critical",
  "department": "one of: PWD, Municipal Corporation, Electricity Board, Water Board, Sanitation Department",
  "description": "A 2-sentence description of the visible civic issue (or image if invalid)",
  "confidence": 0.85,
  "urgencyReason": "One sentence stating why this issue needs immediate attention (or empty if invalid)"
}
Location coordinates: lat=${lat}, lng=${lng}`;

    console.log(`[analyze-issue] Querying Gemini model for lat=${lat}, lng=${lng}...`);
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [imagePart, promptText],
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = cleanJson(response.text || "");
    const result = JSON.parse(raw);
    const sanitized = sanitizeAiResult(result);
    sanitized._model = MODEL;

    res.json(sanitized);
  } catch (err: any) {
    console.error("[analyze-issue] Error:", err);
    res.status(500).json({ detail: err.message || "Internal server error during analysis" });
  }
});

// Predict resolution
app.post("/predict-resolution", (req, res) => {
  try {
    const { issueType = "Other", severity = "Medium", department = "Municipal Corporation" } = req.body;

    const key = `${issueType}_${severity}`;
    let days = RESOLUTION_DAYS[key];
    if (days === undefined) {
      const base = DEPT_BASE_DAYS[department] || 10;
      const mult = SEVERITY_MULTIPLIER[severity] || 1.0;
      days = Math.max(1, Math.round(base * mult));
    }

    const severityConf: Record<string, number> = { Critical: 0.9, High: 0.8, Medium: 0.7, Low: 0.65 };
    res.json({
      predictedResolutionDays: days,
      estimatedDays: days,
      confidence: severityConf[severity] || 0.75,
      historicalNote: `Based on typical ${department} resolution times in India.`,
    });
  } catch (err: any) {
    console.error("[predict-resolution] Error:", err);
    res.status(500).json({ detail: err.message || "Internal server error during prediction" });
  }
});

// Generate formal complaint report
app.post("/generate-report", async (req, res) => {
  const {
    issueType = "Other",
    severity = "Medium",
    department = "Municipal Corporation",
    description = "Civic issue at this location.",
    lat = "28.6139",
    lng = "77.2090",
    reporterName = "Citizen",
  } = req.body;

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const fallbackLetter = `Date: ${today}

To,
The Officer-in-Charge,
${department},
[City/District Office]

Subject: Urgent Complaint Regarding ${issueType} at Location (${lat}, ${lng})

Respected Sir/Madam,

I, ${reporterName}, am writing to bring to your urgent attention a serious civic issue — ${issueType} — observed at the coordinates (${lat}, ${lng}). The severity of this issue has been assessed as ${severity}, which poses a significant inconvenience and potential hazard to the public.

Details of the Issue:
- Issue Type: ${issueType}
- Severity Level: ${severity}
- Location: Latitude ${lat}, Longitude ${lng}
- Description: ${description}

I respectfully request that your department take immediate action to address this issue within 7 working days. Prompt resolution will prevent further inconvenience to residents and potential safety hazards.

Kindly acknowledge receipt of this complaint and keep me informed of the action taken.

Thanking you,

Yours faithfully,
${reporterName}
[Contact: your-email@example.com]

(Submitted via SmartSamadhan AI Platform)`;

  if (!ai) {
    return res.json({ letter: fallbackLetter, generated: false });
  }

  try {
    const promptText = `Write a formal complaint letter dated ${today} to the ${department} about ${issueType} at coordinates (${lat}, ${lng}). Severity: ${severity}. Issue: ${description}. Reporter: ${reporterName}. Include: date header, subject line in bold, body paragraphs explaining the issue, requested action within 7 days, contact details placeholder, and professional closing. Write in formal Indian government letter style.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: promptText,
    });

    res.json({ letter: response.text || fallbackLetter, generated: true });
  } catch (err) {
    console.error("[generate-report] Error:", err);
    res.json({ letter: fallbackLetter, generated: false, error: "AI unavailable — template letter provided." });
  }
});

// Generate quests
app.post("/generate-quests", async (req, res) => {
  const { issueType = "Other", severity = "Medium", description = "Civic issue reported." } = req.body;

  const actionMap: Record<string, string> = { Critical: "Escalate", High: "Document", Medium: "Verify", Low: "Monitor" };
  const pointsMap: Record<string, number> = { Critical: 150, High: 125, Medium: 100, Low: 75 };

  const fallbackQuest = {
    title: `Help resolve this ${issueType}`,
    description: "Visit the location, verify the issue exists, and document with photos to support escalation.",
    points: pointsMap[severity] || 100,
    actionType: actionMap[severity] || "Verify",
  };

  if (!ai) {
    return res.json(fallbackQuest);
  }

  try {
    const promptText = `Generate 1 civic engagement quest for citizens about this issue: ${issueType} (${severity} severity): ${description}
Return ONLY valid JSON, no markdown, no extra text:
{"title": "max 8 words action-oriented title", "description": "1 clear sentence telling citizens what to do", "points": 100, "actionType": "one of: Verify, Document, Monitor, Escalate, Report"}`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: promptText,
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = cleanJson(response.text || "");
    const result = JSON.parse(raw);
    result.points = Math.max(50, Math.min(200, parseInt(result.points) || 100));
    result.actionType = result.actionType || "Verify";
    if (!["Verify", "Document", "Monitor", "Escalate", "Report"].includes(result.actionType)) {
      result.actionType = "Verify";
    }

    res.json(result);
  } catch (err) {
    console.error("[generate-quests] Error:", err);
    res.json(fallbackQuest);
  }
});

// ── VITE MIDDLEWARE SETUP ────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SmartSamadhan Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
