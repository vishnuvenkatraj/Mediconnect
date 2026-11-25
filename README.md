# MediConnect HMS – Centralized Supabase Database Integration

MediConnect is a comprehensive Healthcare Management System featuring six role-specific portals (Patient, Doctor, Nurse, Pharmacy, Laboratory Technician, Admin) connected to one centralized **Supabase PostgreSQL** database with real-time updates and Row-Level Security (RLS).

---

## Centralized Architecture & Portals

All six portals and shared services read and write to the same relational tables in Supabase:

| Portal | Core Tables & Operations |
|---|---|
| **Admin Portal** | `profiles`, `medicines`, `appointments`, `invoices`, `hospital_locations`, hospital analytics |
| **Doctor Portal** | Assigned `appointments`, `patients`, `prescriptions`, `lab_tests`, patient charts, MediSilentAlert calls |
| **Patient Portal** | Profile, `appointments` booking/cancelling, `prescriptions`, `lab_tests`, `invoices` with payment, `wellness_entries`, `queue_entries`, accessibility requests |
| **Nurse Portal** | Inpatient `assigned_patients`, vitals, `patient_charts`, `nurse_tasks`, orderly accessibility transit alerts, `nurse_pages`, `supply_requests` |
| **Pharmacy Portal** | `medicines` inventory, prescription fulfillment queue, dispensing with automatic stock deduction |
| **Lab Technician Portal** | `lab_tests` requests, sample tracking, results entry, and verified diagnostic record generation |
| **Shared Services** | MediBot AI context, MediConnect WayFinder interactive map (`hospital_locations`), MediSilentAlert queue sync (`queue_entries`, `silent_alerts`) |

---

## Database Requirements & Setup

### 1. Prerequisites
- Node.js (v18+)
- A [Supabase](https://supabase.com) account and project

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or `.env.local`):
```bash
cp .env.example .env
```
Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GEMINI_API_KEY=your_gemini_key_here
```
> **Security Note:** Only client-safe keys (`VITE_SUPABASE_ANON_KEY`) are exposed to the browser. The Supabase `service_role` key must never be used in frontend client code.

### 3. Apply SQL Schema & Migrations
In your Supabase project dashboard:
1. Open the **SQL Editor**.
2. Copy and execute [`supabase/schema.sql`](supabase/schema.sql). This creates all 20 relational tables, foreign keys, indexes, and Row-Level Security (RLS) policies.
3. (Optional) Run [`supabase/seed.sql`](supabase/seed.sql) to populate initial sample staff, doctors, inpatient charts, medicines, and appointments.

Alternatively, if using the Supabase CLI:
```bash
supabase db push
# or
supabase db reset
```

### 4. Run the Website Locally
```bash
npm install
npm run dev
```

---

## 🌟 Flagship Innovations & Unique Capabilities

### 1. 📳 MediSilentAlert™ (Inclusive Haptic Queue System)
* **The Problem:** In crowded, noisy hospital lobbies, patients—especially elderly, deaf, or hard-of-hearing individuals—frequently miss their name being called over intercoms, leading to skipped turns and stress.
* **Our Innovation:** A zero-noise, inclusive waiting room alert engine.
* **How It Works Differently:**
  * Uses the **Web Vibration API** (`navigator.vibrate`) to send custom haptic pulse rhythms directly to the patient's phone.
  * Paired with high-contrast, flashing visual banners on the screen ("*Your Turn! Proceed to Room 204*").
  * Real-time queue tracker showing patients ahead in line without standing at the reception desk.

### 2. 🗣️ Hands-Free Patient Access (Voice-Driven Navigation)
* **The Problem:** Patients with motor tremors, paralysis, arthritis, injured hands, or visual impairments struggle to tap tiny buttons on mobile screens.
* **Our Innovation:** A completely hands-free interface powered by bidirectional Web Speech Synthesis & Recognition.
* **How It Works Differently:**
  * Patients can speak naturally: *"Book doctor"*, *"Check my vitals"*, *"Go to prescriptions"*, or *"Check symptoms"*.
  * Built with visual voice wave indicators and instant audio confirmations—enabling true digital accessibility compliance (WCAG).

### 3. 🗺️ WayFinder: Interactive Indoor Hospital GPS & QR Sync
* **The Problem:** Large multi-floor hospitals are confusing mazes. Anxious patients regularly get lost trying to find Radiology, Pathology, or the Pharmacy.
* **Our Innovation:** An interactive 2D HTML5 Canvas indoor route navigator with mobile handoff.
* **How It Works Differently:**
  * **Multi-Floor Routing:** Shows floor-by-floor routes, elevator waypoints, and distance estimates across Ground Floor, Level 1, Level 2, and Level 3.
  * **QR Code Handoff:** Patients can scan a dynamic QR code on the hospital kiosk or desktop screen to instantly open their specific walking route on their personal smartphone—no app download required.
  * **Verified Wheelchair Routes:** Dedicated toggle dynamically reroutes paths strictly via elevators and step-free corridors.

### 4. 🧠 Gemini AI Clinical Triage & Symptom Checker
* **The Problem:** Patients often don't know which specialist they need, leading to misdirected bookings and crowded emergency rooms.
* **Our Innovation:** Real-time conversational AI health triage.
* **How It Works Differently:**
  * Analyzes complex user descriptions and flags emergency warning signs.
  * Automatically recommends the exact clinical department and links directly to one-click booking with that specific specialist.

### 5. 🧬 MediLingo™ (Plain-English Clinical Translator & Interactive Anatomy Explainer)
* **The Problem:** Diagnostic lab reports and clinical summaries are dense with confusing jargon, triggering patient panic and unguided web searching.
* **Our Innovation:** In-portal medical translation and anatomical visualization.
* **How It Works Differently:**
  * Translates lab tests and clinical notes into 6th-grade reading level plain English.
  * Features an interactive SVG anatomical body silhouette highlighting the exact system (Cardiovascular, Respiratory, Musculoskeletal, etc.) evaluated.
  * Generates "3 Smart Questions for Your Doctor" with 1-click clipboard copy and speech synthesis read-aloud.

### 6. 💊 RxCompanion™ (Circadian Chronotherapy Timeline & Food-Drug Safety Radar)
* **The Problem:** Static medication lists don't guide patients on when or how to take medicines relative to biological clocks and meals.
* **Our Innovation:** A 24-hour chronological timeline (Morning, Midday, Evening, Bedtime).
* **How It Works Differently:**
  * Categorizes prescriptions into optimal absorption time windows.
  * Visual Food-Drug Safety Radar flags dairy exclusions, meal requirements, and photosensitivity alerts.
  * 1-tap adherence logger with streak milestones ("🔥 5-Day Adherence Streak!").

### 7. 🕊️ MindfulCare™ (White-Coat Syndrome Calmer & Pre-Visit Agenda Builder)
* **The Problem:** Patients experience acute blood pressure and heart rate spikes ("White Coat Syndrome") in waiting rooms and forget critical symptoms in front of the doctor.
* **Our Innovation:** Tactile relaxation and guided visit prep.
* **How It Works Differently:**
  * 4-4-4-4 Box Breathing visual circle synchronized with gentle device vibration pulses via the Web Vibration API.
  * 2-minute thought organizer formats a concise "Doctor, Here Is What I'm Feeling" pocket brief to hand to the physician.

### 8. 🛡️ CareRing™ (Ambient Family Guardian Beacon)
* **The Problem:** Family caregivers wait in anxious uncertainty while patients go through hospital rooms.
* **Our Innovation:** Ambient milestone telemetry with zero privacy invasion.
* **How It Works Differently:**
  * Generates a companion PIN and shareable link for family members.
  * Broadcasts milestone pings (Check-in, Room 204 Called, In Consultation, Lab Sample, Pharmacy Ready).
  * 1-tap "Heartbeat / I'm Doing Great ❤️" reassuring ping.

### 9. 🌿 BioRhythm & Lifestyle Synergy Companion
* **The Problem:** Health tracking often isolates clinical numbers from daily living habits.
* **Our Innovation:** Interactive lifestyle and circadian companion.
* **How It Works Differently:**
  * Interactive 8-glass water tracker, circadian sleep and recovery quality slider, and diet focus selectors.
  * Synergy engine surfaces clinical correlations (e.g. how 7+ hours of sleep directly stabilizes systolic blood pressure).

### 10. 🏁 Recovery Pathways (Post-Care Healing Milestone Roadmap)
* **The Problem:** Patients feel lost and anxious during home recovery, unable to distinguish normal healing from complications.
* **Our Innovation:** Day-by-day interactive recovery roadmap for Cardiovascular, Orthopedic, and Respiratory pathways.
* **How It Works Differently:**
  * Day-by-day interactive milestone checkpoints with completion meters.
  * Visual "Normal & Expected Healing vs. Red Flag Complications" side-by-side diagnostic safety matrix.

---

## Key Technical Features

1. **Relational Consistency:**
   - When a doctor writes a prescription, the Pharmacy Fulfillment Queue and Patient Portal immediately receive it.
   - When a pharmacy dispenses a medication, medicine stock automatically decrements across inventory, admin, and patient views.
   - When a patient books an appointment with accessibility needs (wheelchair/sign language/printed summaries), the Nurse Portal orderly alert list reflects it in real time.
   - When a doctor triggers a patient call, the live queue and MediSilentAlert notify the patient on their device with vibration and directional WayFinder navigation.
2. **AI Clinical Segregation:**
   - AI suggestions generated by the Symptom Checker are written strictly to `clinical_ai_suggestions`.
   - AI suggestions are clearly labeled with non-binding clinical disclaimers and require physician review before inclusion into verified `medical_records`.
3. **Resilient Offline / Fallback Caching:**
   - If Supabase environment variables are not yet entered or network is unreachable, the system automatically falls back to local storage and in-memory cache without crashing or throwing errors.

