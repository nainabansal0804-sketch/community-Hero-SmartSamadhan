<h1 align="center"># SmartSamadhan 🏙️</h1>

<div align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**AI-Powered Hyperlocal Civic Issue Solver**

*Built for [Vibe2Ship](https://codingninjas.com) by CodingNinjas × Google for Developers*


</div>


---

## 🌟 Overview

SmartSamadhan is an **AI-powered hyperlocal civic issue reporting and resolution platform** that empowers citizens to identify, report, and track community problems — from broken streetlights to overflowing garbage — while holding local authorities accountable through intelligent automation.

Traditional civic complaint systems are fragmented, opaque, and slow. Citizens have no visibility into whether their complaints are being acted upon, and municipalities struggle to prioritize issues effectively. SmartSamadhan bridges this gap by combining **Google Gemini's Vision AI** with a fully agentic pipeline that automatically classifies issues, clusters geographic hotspots, and escalates unresolved problems with auto-generated official complaint letters.

Beyond reporting, SmartSamadhan transforms civic participation into an engaging experience through a **gamification layer** — Civic Points, badges, and leaderboards — motivating communities to stay involved and turning every resolved pothole into a community win.

---

## ✨ Features

### 🤖 AI Features
- **Gemini Vision Analysis** — Upload a photo and let AI identify the issue type, severity, and responsible department automatically
- **Auto-Classification** — Categorizes issues (road damage, waste management, water supply, etc.) without manual input
- **Official Complaint Letter Generation** — Gemini drafts formal complaint letters addressed to the correct authority
- **Resolution Time Prediction** — AI estimates how long an issue will take to resolve based on type and severity

### 🌍 Community Features
- **Community Verification** — Residents upvote issues to validate and prioritize them
- **Auto-Escalation Agent** — Automatically escalates issues that receive 3+ upvotes to higher authorities
- **Area Clustering Alerts** — Detects when 3+ similar issues appear within a 1 km radius and triggers a zone-level alert
- **Status Timeline** — Real-time progress tracking from report submission to resolution

### 🏆 Gamification
- **Civic Points System** — Earn points for reporting, upvoting, and verifying issues
- **Badges & Achievements** — Unlock badges for civic milestones (First Report, Neighbourhood Hero, etc.)
- **Community Leaderboard** — City-wide and area-specific rankings to encourage healthy competition
- **Impact Dashboard** — Visualize your personal and community contribution with charts and analytics

### 🗺️ Maps & Tracking
- **Live Issue Map** — Interactive Leaflet.js map powered by OpenStreetMap showing all active issues
- **Color-Coded Severity Pins** — Instantly identify critical, high, medium, and low severity issues at a glance
- **Advanced Filters** — Filter by issue type, severity, status, and date range
- **Sidebar Details** — Click any pin to view full issue details without leaving the map

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SmartSamadhan System                        │
└─────────────────────────────────────────────────────────────────┘

         User (Browser / Mobile)
                  │
                  ▼
    ┌─────────────────────────┐
    │    React + Vite         │   ← Tailwind CSS, Leaflet.js
    │    Frontend (Vercel)    │   ← Firebase Auth (Google OAuth)
    └────────────┬────────────┘
                 │  REST API calls
                 ▼
    ┌─────────────────────────┐       ┌──────────────────────┐
    │   FastAPI Backend       │──────▶│   Google Gemini API  │
    │   (Railway)             │       │  (Vision + Text)     │
    └────────────┬────────────┘       └──────────────────────┘
                 │
                 ▼
    ┌─────────────────────────┐       ┌──────────────────────┐
    │   Firebase Firestore    │       │   Cloudinary         │
    │   (Issues, Users,       │       │   (Image Storage)    │
    │    Points, Badges)      │       └──────────────────────┘
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                  Agentic Pipeline                       │
    │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
    │  │ Classifier  │→ │  Clustering  │→ │  Escalation   │  │
    │  │   Agent     │  │    Agent     │  │    Agent      │  │
    │  └─────────────┘  └──────────────┘  └───────────────┘  │
    └─────────────────────────────────────────────────────────┘
```

### Tech Stack at a Glance

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python FastAPI |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google OAuth) |
| AI | Google Gemini API (Vision + Text) |
| Maps | Leaflet.js + OpenStreetMap |
| Image Storage | Cloudinary |
| Deployment | Vercel (Frontend) + Railway (Backend) |

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js** 18+ — [Download](https://nodejs.org/)
- **Python** 3.10+ — [Download](https://python.org/)
- **Firebase** account — [Create project](https://console.firebase.google.com/)
- **Google AI Studio** API key — [Get key](https://aistudio.google.com/app/apikey)
- **Cloudinary** account — [Sign up](https://cloudinary.com/)

---

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/nainabansal0804-sketch
cd SmartSamadhan
```

#### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Fill in your environment variables (see section below)
```

#### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Fill in your GEMINI_API_KEY
```

#### 4. Configure Environment Variables

See the [Environment Variables](#-environment-variables) section below for all required keys.

#### 5. Run the Frontend

```bash
# From the root directory
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### 6. Run the Backend

```bash
# From the backend directory (with venv activated)
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

---

### 🔑 Environment Variables

#### Frontend (`.env`)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (e.g. `project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |

#### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini Vision + Text |

---

## 🤖 Agentic Pipeline

SmartSamadhan is built around an intelligent multi-step agentic pipeline that automates the entire lifecycle of a civic issue — from detection to escalation.

```
 Step 1: Photo Upload
    │  User captures and uploads an issue photo
    ▼
 Step 2: Gemini Vision Analysis
    │  Gemini Vision identifies: issue type, severity level,
    │  responsible department, suggested action
    ▼
 Step 3: Firestore Persistence
    │  Classified issue saved with geolocation, timestamp,
    │  and user metadata
    ▼
 Step 4: Civic Quest Generation
    │  Agent generates a community quest linked to the issue
    │  (e.g., "Get 5 neighbours to verify this pothole")
    ▼
 Step 5: Area Clustering Check
    │  Agent scans for 3+ similar issues within a 1 km radius
    │  → Triggers zone-level alert if threshold met
    ▼
 Step 6: Community Upvotes
    │  Residents upvote to verify; threshold triggers escalation
    ▼
 Step 7: Escalation Agent (3+ upvotes)
    │  Gemini drafts an official complaint letter addressed
    │  to the correct municipal department
    ▼
 Step 8: Area Alert
    │  If 3+ same-type issues detected within 1 km:
    │  → Hotspot alert sent to area representatives
    └─ → Dashboard updated with clustering heatmap
```

### Agent Roles

| Agent | Trigger | Action |
|---|---|---|
| **Classifier Agent** | Photo upload | Gemini Vision analysis → type, severity, department |
| **Quest Agent** | Issue saved | Generates civic engagement challenge |
| **Clustering Agent** | New issue added | Scans 1 km radius for issue density |
| **Escalation Agent** | 3+ upvotes received | Drafts official complaint letter via Gemini |
| **Alert Agent** | Cluster threshold met | Notifies area reps and updates dashboard |

---

## 📸 Screenshots

### 🏠 Home Page
*Landing page with live city stats, recent issues, and call-to-action*
<img width="1896" height="968" alt="image" src="https://github.com/user-attachments/assets/d4c3c0ab-29ad-4517-89d0-cf9a07e732d2" />

---

### 📷 Issue Reporter with AI Analysis
*Photo upload interface with real-time Gemini Vision analysis results*
<img width="1659" height="893" alt="image" src="https://github.com/user-attachments/assets/f993fbe5-b378-4dda-9e0d-187b4d5314ea" />


---

### 🔴 Live Issue
*Collaborative validation, community verification, and live prioritization*
<img width="810" height="922" alt="image" src="https://github.com/user-attachments/assets/fa2e7f9c-07dc-4668-a675-26dedf695611" />



---

### 🗺️ Live Map
*Interactive map with color-coded severity pins and filter sidebar*
<img width="1622" height="905" alt="image" src="https://github.com/user-attachments/assets/c23e5045-bdcf-4d52-8891-e2d48a22f5a6" />



---

### 📊 Impact Dashboard
*Analytics charts showing issue resolution rates, category breakdown, and user impact*
<img width="808" height="861" alt="image" src="https://github.com/user-attachments/assets/cd46758f-9aab-42c7-871a-97fefb0188ac" />



---

### 🏆 Leaderboard
*Civic Points rankings with badge showcase and area filters*
<img width="611" height="756" alt="image" src="https://github.com/user-attachments/assets/7e40972a-54f7-4e66-a3a9-2d86d7d346a1" />


---

## 🛠️ API Endpoints

The FastAPI backend exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/analyze-issue` | Accepts an image + location; returns Gemini Vision classification (type, severity, department) |
| `POST` | `/generate-report` | Generates an official complaint letter for an escalated issue using Gemini |
| `POST` | `/predict-resolution` | Predicts estimated resolution time based on issue type, severity, and historical data |
| `POST` | `/generate-quests` | Creates civic quest challenges linked to a specific reported issue |
| `GET` | `/health` | Health check — returns API status and version |

#### Example Request: Analyze Issue

```bash
curl -X POST http://localhost:8000/analyze-issue \
  -H "Content-Type: multipart/form-data" \
  -F "image=@pothole.jpg" \
  -F "latitude=28.6139" \
  -F "longitude=77.2090"
```

#### Example Response

```json
{
  "issue_type": "Road Damage",
  "severity": "High",
  "department": "Public Works Department",
  "description": "Large pothole detected on road surface, posing risk to vehicles.",
  "suggested_action": "Immediate road repair required.",
  "estimated_resolution_days": 7
}
```

---

## 📄 Pages

| Page | Route | Description |
|---|---|---|
| **Home** | `/` | Landing page with platform stats and featured issues |
| **Reporter** | `/report` | Photo upload + Gemini AI analysis + map pin placement |
| **Map** | `/map` | Live issue map with filters and detail sidebar |
| **Issue Detail** | `/issue/:id` | Status timeline, upvote, and complaint letter download |
| **Dashboard** | `/dashboard` | Impact charts and personal analytics |
| **Leaderboard** | `/leaderboard` | Civic Points rankings and badge showcase |
| **Profile** | `/profile` | User stats and activity feed |
| **Settings** | `/settings` | Profile editing and notification preferences |

---

## 🏆 Hackathon

SmartSamadhan was built for **Vibe2Ship** — a hackathon organized by **CodingNinjas × Google for Developers**.

- **Problem Statement Chosen:** Community Hero — Hyperlocal Problem Solver
- **Track:** Agentic AI + Google Technologies

### Evaluation Criteria Addressed

| Criterion | Weight | How SmartSamadhan Addresses It |
|---|---|---|
| **Problem Solving & Impact** | 20% | Directly tackles the civic complaint gap affecting millions in Indian cities; measurable through issue resolution tracking |
| **Agentic Depth** | 20% | Multi-step agentic pipeline: Classifier → Quest → Clustering → Escalation → Alert agents |
| **Innovation & Creativity** | 20% | Unique combination of Vision AI, gamification, and auto-escalation for civic participation |
| **Usage of Google Technologies** | 15% | Google Gemini API (Vision + Text), Firebase (Auth + Firestore), deployed on Google-ecosystem tools |
| **Product Experience & Design** | 10% | Polished UI with Tailwind CSS, responsive design, interactive maps, and smooth UX flows |
| **Technical Implementation** | 10% | Full-stack app with React, FastAPI, Firebase, Cloudinary, and a real agentic backend |
| **Completeness & Usability** | 5% | Fully functional end-to-end: report → classify → track → escalate → resolve |

---

## 🗺️ Roadmap

The following features are planned for future releases:

- 📱 **Mobile App** — React Native app for iOS and Android with camera integration
- 💬 **WhatsApp Bot Integration** — Report issues directly via WhatsApp without opening the app
- 🏛️ **Municipality Dashboard** — Dedicated portal for local government officials to manage and resolve issues
- 🧠 **ML-Based Resolution Prediction** — Train a custom model on historical resolution data for more accurate ETAs
- 🌐 **Multi-Language Support** — Localization in Hindi, Tamil, and Telugu to reach Tier 2 and Tier 3 cities
- 🔔 **Push Notifications** — Real-time alerts when your reported issue is updated or resolved
- 📡 **Offline Mode** — Queue reports offline and sync when connectivity is restored

---

## 👨‍💻 Author

**NAINA**
MCA masters of Computer Application
IPU University


---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 NAINA

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

Made with ❤️ for Indian cities and the communities that call them home.

**[⬆ Back to Top](#SmartSamadhan-️)**

</div>
