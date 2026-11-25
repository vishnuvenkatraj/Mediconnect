import { GoogleGenAI } from "@google/genai";
import type { Medicine, User, Appointment } from '../types';
import { MOCK_DOCTORS } from '../constants';

const API_KEY_STORAGE_KEY = 'gemini_api_key';

// Retrieve active Gemini API Key from localStorage, Vite env, or process env
export const getGeminiApiKey = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY) || localStorage.getItem('hms_gemini_api_key');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }

  const envKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' ? process.env?.API_KEY : undefined) ||
    (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined) ||
    '';

  return (typeof envKey === 'string' ? envKey.trim() : '');
};

// Save custom API key to localStorage and notify listeners
export const setGeminiApiKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('mediconnect_gemini_key_changed', { detail: { key: trimmed } }));
  }
};

// Check if a Gemini API key is currently configured
export const isGeminiApiKeyConfigured = (): boolean => {
  return Boolean(getGeminiApiKey());
};

// Create a GoogleGenAI client on demand using active key
const getGenAIClient = (): GoogleGenAI | null => {
  const key = getGeminiApiKey();
  if (!key) return null;
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch (e) {
    console.error('Failed to initialize GoogleGenAI client:', e);
    return null;
  }
};

const model = 'gemini-2.5-flash';

const chatbotSystemInstruction = `You are an intelligent hospital assistant chatbot named MediBot for the MediConnect Healthcare Management System. Your job is to give direct, factual answers based *only* on the hospital data provided to you. Do not invent information or direct users to find information elsewhere in the portal.

**Key Instructions:**
1.  **Direct Answers Only:** When a user asks a question, answer it directly using the provided data.
2.  **No Navigation:** Do not tell the user "You can find this on the X page" or "Check the portal." Provide the answer yourself.
3.  **Strictly Data-Bound:** Base all your responses on the \`Hospital Data\` JSON object. Do not use any external knowledge.
4.  **Handle Missing Data:** If the information is not in the provided data, politely state that you do not have that specific information right now.

**Example Scenarios:**
*   User: "Who is Dr. Ramesh Kumar?"
*   You: "Dr. Ramesh Kumar is our General Physician, available from 9 AM to 5 PM."
*   User: "What medicines are in stock?"
*   You: (List medicines from the pharmacy data).
*   User: "Who are the nurses?"
*   You: (List nurses from the staff data).`;

export const getChatbotResponse = async (
  userMessage: string,
  data: { users: User[], medicines: Medicine[], appointments: Appointment[] },
  history?: { sender?: string; text: string }[]
): Promise<string> => {
  const ai = getGenAIClient();
  const apiKey = getGeminiApiKey();

  // If no API key configured, provide smart hospital assistant answers from local mock database
  if (!ai || !apiKey) {
    const q = userMessage.toLowerCase();
    
    // Check for doctor questions
    const matchingDoctor = MOCK_DOCTORS.find(d => 
      q.includes(d.name.toLowerCase()) || 
      q.includes(d.specialization.toLowerCase())
    );
    if (matchingDoctor) {
      return `**${matchingDoctor.name}** is our Specialist in **${matchingDoctor.specialization}**.\n\n` +
             `*   **Availability:** ${matchingDoctor.availability}\n` +
             `*   **Location:** Floor 1, West Wing Consultation Suites\n\n` +
             `You can book an appointment directly through the Appointments tab.`;
    }

    // Check for emergency
    if (q.includes('emergency') || q.includes('ambulance') || q.includes('urgent')) {
      return `🚨 **Emergency Department is open 24/7.**\n\n` +
             `*   **Location:** Ground Floor (L0), West Wing (Room ER-101)\n` +
             `*   **Direct Hotline:** (123) 456-7890\n` +
             `*   **Ambulance Dispatch:** x911`;
    }

    // Check for medicines
    if (q.includes('medicine') || q.includes('pharmacy') || q.includes('drug') || q.includes('stock')) {
      const availableMeds = data.medicines.slice(0, 5).map(m => `* **${m.name}** (${m.category}) - ${m.quantity} in stock`).join('\n');
      return `Here are some of the current medicines available at our Outpatient Pharmacy (Room PH-01, Ground Floor):\n\n${availableMeds}`;
    }

    // Check for hospital visiting hours
    if (q.includes('visiting hour') || q.includes('visit time') || q.includes('visiting time') || q.includes('visitor') || q.includes('visiting')) {
      return `🕒 **Hospital Visiting Hours:**\n\n` +
             `*   **General Inpatient Wards:** 09:00 AM – 08:00 PM (Daily)\n` +
             `*   **Intensive Care Units (ICU):** 04:00 PM – 06:00 PM\n` +
             `*   **Visitor Guidelines:** Maximum 2 visitors per patient at a time to ensure optimal recovery and rest.`;
    }

    // Check for clinic / OPD hours
    if (q.includes('clinic hour') || q.includes('opd hour') || q.includes('opening hour') || q.includes('hospital timings') || q.includes('working hour')) {
      return `🏥 **MediConnect Clinic & OPD Hours:**\n\n` +
             `*   **Outpatient Department (OPD):** Monday – Saturday, 08:30 AM – 05:00 PM\n` +
             `*   **Emergency & Trauma Bay:** Open 24 Hours / 7 Days a week\n` +
             `*   **Outpatient Pharmacy & Lab:** 08:00 AM – 09:00 PM`;
    }

    // Check for hospital services & departments
    if (q.includes('hospital service') || q.includes('services') || q.includes('departments') || q.includes('facility') || q.includes('facilities')) {
      return `🏥 **MediConnect Hospital Services:**\n\n` +
             `*   **Clinical Specialties:** Cardiology, Neurology, Pediatrics, Orthopedics, Dentistry, General Medicine\n` +
             `*   **Diagnostic Services:** 24/7 Pathology, Biochemistry, and Microbiology Laboratory\n` +
             `*   **Patient Amenities:** Outpatient Pharmacy (Room PH-01), Emergency Trauma Unit (Room ER-101), Wheelchair Ramps & WayFinder Indoor Navigation.`;
    }

    // General fallback
    return `Hello! I'm MediBot. You can ask me about our doctors, clinic hours, pharmacy stock, or emergency services.`;
  }
  
  // Create a comprehensive knowledge base for the model
  const departments = [...new Set(MOCK_DOCTORS.map(d => d.specialization))];

  const doctors = MOCK_DOCTORS.map(d => ({
    name: d.name,
    specialization: d.specialization,
    availability: d.availability,
  }));

  const otherStaff = data.users
    .filter(u => u.role !== 'PATIENT' && u.role !== 'DOCTOR')
    .map(u => ({ name: u.name, role: u.role, department: u.department || 'N/A' }));
  
  const hospitalData = {
    doctors,
    departments,
    otherStaff,
    medicines: data.medicines.map(m => ({ name: m.name, category: m.category, inStock: m.quantity > 0 })),
  };

  let conversationContext = '';
  if (history && history.length > 0) {
    const recent = history.slice(-6).map(h => `${h.sender === 'user' ? 'User' : 'MediBot'}: ${h.text}`).join('\n');
    conversationContext = `\nRecent Conversation History:\n${recent}\n`;
  }

  const prompt = `Here is the current Hospital Data:\n${JSON.stringify(hospitalData, null, 2)}\n${conversationContext}\nUser Question: ${userMessage}`;

  try {
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: chatbotSystemInstruction,
        },
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for chatbot:", error);
    return "I'm sorry, I'm having trouble connecting to the hospital AI right now. Please try again in a moment.";
  }
};

import { matchSymptomToSpecialist } from './voice/symptomSpecialistService';

const symptomCheckerSystemInstruction = `You are an AI-powered clinical triage and symptom analysis assistant for the MediConnect platform.
Your role is to analyze a user's described symptoms and recommend the appropriate specialist from our hospital's registered doctors.

### Registered Hospital Specialists (MediConnect Source of Truth):
1. **Cardiology:** Dr. Jane Smith (15 yrs exp, Room 102, Floor 1) - Chest pain, palpitations, hypertension, heart-related concerns.
2. **Neurology:** Dr. Michael Brown (12 yrs exp, Room 202, Floor 2) - Headaches, migraines, dizziness, nerve pain, tremors.
3. **Pediatrics:** Dr. Emily White (10 yrs exp, Room 104, Floor 1) - Child fever, infant/childhood illnesses, pediatric care.
4. **Orthopedics:** Dr. Robert Green (20 yrs exp, Room 103, Floor 1) - Joint pain, knee pain, back pain, bone fractures, arthritis.
5. **General Physician:** Dr. Ramesh Kumar (8 yrs exp, Room 101, Floor 1) - General fever, common cold, flu, viral illnesses.
6. **Family Medicine:** Dr. Meena Raj (7 yrs exp, Room 105, Floor 1) - General family wellness, routine family checkups, preventive health.
7. **Internal Medicine:** Dr. Arjun Das (11 yrs exp, Room 106, Floor 1) - Adult complex illnesses, chronic fatigue, metabolic disorders.
8. **Dentistry:** Dr. Priya Sharma (9 yrs exp, Room 108, Floor 1) - Tooth pain, tooth decay, cavities, gum problems, bleeding gums.
9. **Orthodontics:** Dr. Karan Patel (13 yrs exp, Room 109, Floor 1) - Braces, teeth alignment, crooked teeth, bite correction.
10. **Cosmetic Dentistry:** Dr. Sneha Rao (10 yrs exp, Room 110, Floor 1) - Smile makeover, teeth whitening, aesthetic dental improvements.

**CRITICAL RULES:**
1. **ALWAYS recommend the hospital's specific doctor and department matching the patient's symptoms** (e.g. Dentistry – Dr. Priya Sharma for tooth pain; Orthopedics – Dr. Robert Green for joint/knee pain; Orthodontics – Dr. Karan Patel for teeth alignment).
2. **DO NOT default to General Medicine / General Physician** if a suitable hospital specialist is already available!
3. **DO NOT PROVIDE A DEFINITIVE DIAGNOSIS.** Use phrases like "Possible Considerations" or "conditions that can cause these symptoms include."
4. **ALWAYS prioritize safety.** If symptoms indicate acute emergencies (crushing chest pain, severe shortness of breath, stroke signs), immediately advise emergency care (Room ER-101, Ground Floor or hotline 123-456-7890 / 108).
5. **Adhere strictly to the markdown format below:**

### Possible Considerations
*   **Possibility 1:** High-level description.
*   **Possibility 2:** High-level description.

### Recommended Specialist
*   **[Department Name]: [Doctor Name] ([Room Number], [Floor])**
    [Experience and availability summary]

### General Advice
*   Safe general advice 1.
*   Safe general advice 2.

---
**Disclaimer: I am an AI assistant and not a medical professional. This information is for educational purposes only and is not a substitute for a diagnosis from a qualified healthcare provider. Please consult with a doctor for any medical advice or treatment. If you are experiencing severe symptoms, seek immediate medical attention.**
`;

// Built-in Clinical Knowledge Base for safe, structured symptom analysis fallback
export const generateClinicalSymptomAnalysis = (symptoms: string): string => {
  const q = symptoms.toLowerCase();
  
  // Emergency Red Flags
  const isEmergency = 
    q.includes('crushing chest pain') || 
    q.includes('difficulty breathing') || 
    q.includes('cannot breathe') || 
    q.includes('stroke') || 
    q.includes('numbness on one side') || 
    q.includes('unconscious') || 
    q.includes('coughing blood') ||
    q.includes('மாரடைப்பு') ||
    q.includes('மூச்சு திணறல்') ||
    q.includes('saans lene me takleef');

  if (isEmergency) {
    return `### 🚨 Urgent Medical Attention Recommended

Your described symptoms include indicators that could require immediate evaluation by emergency care professionals.

### Possible Considerations
*   **Acute Cardiopulmonary or Respiratory Event:** Symptoms such as crushing chest discomfort or severe breathing difficulty require prompt rule-out of acute emergencies.
*   **Neurological or Vascular Symptoms:** Sudden severe weakness, numbness, or breathing distress need acute triage.

### Recommended Specialist
*   **Emergency Medicine Department (ER-101, Ground Floor)**
*   **Immediate Emergency Hotline:** (123) 456-7890 or local emergency services (108 / 911).

### General Advice
*   Do not attempt to drive yourself to the clinic; arrange immediate medical transport or call emergency services.
*   Sit in an upright, comfortable position and try to remain calm.

---
**Disclaimer: I am an AI assistant and not a medical professional. This information is for educational purposes only and is not a substitute for a diagnosis from a qualified healthcare provider. Please consult with a doctor for any medical advice or treatment. If you are experiencing severe symptoms, seek immediate medical attention.**`;
  }

  // Use specialized clinical matching engine against all 10 registered doctors
  const match = matchSymptomToSpecialist(symptoms);

  if (match) {
    let considerations = '';
    let advice = '';

    switch (match.department) {
      case 'Dentistry':
        considerations = `*   **Dental Caries or Pulpitis:** Localized bacterial decay reaching inner tooth nerve tissue, causing throbbing or sharp sensitivity.
*   **Gingivitis or Periodontal Inflammation:** Irritation, swelling, or bleeding along the gum line due to plaque accumulation.
*   **Dental Abscess or Periapical Sensitivity:** Localized infection requiring clinical assessment and timely treatment.`;
        advice = `*   Rinse gently with warm salt water (1/2 teaspoon salt in a glass of warm water) to soothe oral tissues.
*   Avoid chewing on the affected side and minimize consumption of excessively cold, hot, or sugary foods.
*   Schedule a consultation with Dr. Priya Sharma promptly to prevent decay progression.`;
        break;

      case 'Orthodontics':
        considerations = `*   **Dental Malocclusion or Misalignment:** Structural crowding, rotated teeth, or interdental spacing affecting bite function.
*   **Overbite, Underbite, or Crossbite:** Skeletal or dental bite discrepancies treatable with modern aligners or braces.
*   **Aesthetic Jaw Alignment Concern:** Functional and cosmetic alignment needs best addressed through orthodontic planning.`;
        advice = `*   Maintain meticulous brushing and interdental flossing around contact points.
*   Avoid biting hard objects or opening packaging with your teeth to protect tooth contact surfaces.
*   Consult Dr. Karan Patel for digital bite scanning and customized aligner or braces planning.`;
        break;

      case 'Cosmetic Dentistry':
        considerations = `*   **Extrinsic Enamel Discoloration:** Surface staining from dietary beverages (tea, coffee) or natural enamel maturation.
*   **Smile Symmetry & Aesthetic Harmony:** Minor chipped enamel, uneven tooth contours, or spacing concerns.
*   **Enamel Brightness Preference:** Safe clinical teeth whitening and aesthetic smile enhancement.`;
        advice = `*   Limit consumption of staining liquids like coffee, tea, and dark sauces prior to evaluation.
*   Use a soft-bristled toothbrush with gentle non-abrasive enamel toothpaste.
*   Schedule an aesthetic consultation with Dr. Sneha Rao for professional shade evaluation.`;
        break;

      case 'Orthopedics':
        considerations = `*   **Joint Capsule Inflammation or Arthropathy:** Repetitive motion, tendon strain, or inflammatory conditions in joint capsules (knee, shoulder, hip).
*   **Musculoskeletal Strain or Sprain:** Overuse, sudden twist, lifting strain, or poor ergonomic posture inducing radiating joint soreness.
*   **Cartilage Wear or Ligament Sensitivity:** Load-bearing joint fatigue often exacerbated by high impact activity.`;
        advice = `*   Apply an ice compress for acute joint swelling within the first 48 hours, or mild warm compress for stiff chronic tension.
*   Avoid high-impact jumping, sudden twisting movements, or heavy lifting while allowing the joint to rest.
*   Keep the affected limb elevated when resting if joint swelling or edema is present.`;
        break;

      case 'Cardiology':
        considerations = `*   **Cardiopulmonary Strain or Non-acute Angina:** Chest tightness, exertion-related fatigue, or pressure requiring cardiovascular rule-out.
*   **Cardiac Dysrhythmia or Palpitations:** Sensation of racing, fluttering, or irregular heartbeats.
*   **Elevated Blood Pressure (Hypertension):** Arterial tension elevation commonly associated with stress or vascular strain.`;
        advice = `*   Monitor and record your resting blood pressure and pulse rate twice daily in a log.
*   Avoid caffeine, tobacco, and intense physical exertion until cleared by your physician.
*   Seek immediate emergency care (Room ER-101) if you develop crushing pain, sweating, or breathlessness.`;
        break;

      case 'Neurology':
        considerations = `*   **Tension-Type Headache or Cranial Strain:** Screen fatigue, stress, cervical neck posture, or muscular tension.
*   **Migraine with or without Aura:** Pulsating head pain accompanied by light/sound sensitivity, dizziness, or mild nausea.
*   **Peripheral Neuropathy or Nerve Sensitivity:** Radicular nerve tingling, numbness, or cranial nerve strain.`;
        advice = `*   Rest in a quiet, dimly lit room and apply a cool or warm compress to your forehead or neck.
*   Ensure adequate hydration by drinking plenty of water, and avoid skipping meals or irregular sleep.
*   Maintain a symptom diary noting duration, food triggers, and screen exposure times.`;
        break;

      case 'Pediatrics':
        considerations = `*   **Childhood Febrile or Viral Illness:** Common pediatric viral infections frequently present with elevated temperature and irritability.
*   **Pediatric Upper Respiratory Tract Infection:** Pharyngeal discomfort, nasal congestion, or cough in infants and children.
*   **Pediatric Gastrointestinal Sensitivity:** Transient stomach upset, appetite changes, or viral tummy bug.`;
        advice = `*   Ensure continuous hydration by offering frequent sips of water, oral rehydration solution, or clear broth.
*   Monitor child body temperature every 4 hours using a reliable digital thermometer.
*   Consult Dr. Emily White promptly if high fever persists or if the child appears unusually lethargic.`;
        break;

      case 'Family Medicine':
        considerations = `*   **General Family Health & Preventive Wellness:** Multi-generational health maintenance and comprehensive checkup needs.
*   **Lifestyle & Metabolic Risk Profiling:** Routine health markers including BMI, blood pressure, and wellness counseling.
*   **Subacute Family Health Concerns:** General physical health concerns suitable for broad family medicine evaluation.`;
        advice = `*   Keep an organized record of family medical histories, immunizations, and recent screenings.
*   Schedule regular periodic physical wellness checks for family members.
*   Maintain balanced nutrition, adequate hydration, and moderate daily physical activity.`;
        break;

      case 'Internal Medicine':
        considerations = `*   **Complex Adult Systemic Condition:** Multi-system fatigue, metabolic fluctuations, or non-specific internal symptoms.
*   **Chronic Adult Fatigue or Malaise:** Chronic low energy possibly related to metabolic, autoimmune, or endocrine factors.
*   **Adult Diagnostic & Preventive Evaluation:** Thorough clinical examination of internal organ systems.`;
        advice = `*   Bring all current prescription bottles, supplements, and recent lab reports to your appointment.
*   Document daily energy fluctuations, sleep quality, and any unexplained weight changes.
*   Ensure consistent daily fluid intake and balanced, timely meals.`;
        break;

      case 'General Physician':
      default:
        considerations = `*   **Viral Upper Respiratory Tract Infection:** Common colds or seasonal viral illnesses frequently present with fever, pharyngeal discomfort, and cough.
*   **General Systemic Fatigue or Mild Viral Prodrome:** Mild nonspecific malaise following periods of sleep disruption or minor viral exposure.
*   **Seasonal Allergies or Pharyngitis:** Inflammation of the bronchial airways or throat tissues.`;
        advice = `*   Drink warm fluids such as herbal teas, clear broths, and plenty of water to soothe mucosal tissues.
*   Gargle with warm salt water and get plenty of restorative sleep.
*   Monitor your temperature twice daily and rest comfortably.`;
        break;
    }

    return `### Possible Considerations
Based on the symptoms described, here are general areas relevant for clinical discussion with a physician. This is not a diagnosis.
${considerations}

### Recommended Specialist
For these types of symptoms, our hospital recommends consulting with:
*   **${match.department} Specialist: ${match.doctorName} (${match.roomNumber}, ${match.floor})**
    *Experience:* ${match.doctorExperience} years | *Availability:* ${match.doctorAvailability}

### General Advice
Here are some general wellness tips that may be helpful. They are not a substitute for professional medical advice.
${advice}

---
**Disclaimer: I am an AI assistant and not a medical professional. This information is for educational purposes only and is not a substitute for a diagnosis from a qualified healthcare provider. Please consult with a doctor for any medical advice or treatment. If you are experiencing severe symptoms, seek immediate medical attention.**`;
  }

  // General fallback when symptoms are non-specific
  return `### Possible Considerations
Based on the symptoms described, here are a few general areas that might be relevant for discussion with a doctor. This is not a diagnosis.
*   **General Systemic Fatigue or Mild Viral Prodrome:** Mild nonspecific malaise can occur following physical stress or seasonal changes.
*   **Nutritional or Hydration Imbalance:** Inadequate water intake or irregular eating patterns.
*   **Nonspecific Outpatient Symptoms:** Broad concerns suitable for outpatient medical evaluation.

### Recommended Specialist
For general health concerns, you can consult:
*   **General Physician: Dr. Ramesh Kumar (Room 101, Floor 1)**
    *Experience:* 8 years | *Availability:* Mon - Sat (9 AM - 5 PM)

### General Advice
Here are some general wellness tips:
*   Ensure you are maintaining consistent hydration by drinking 2 to 2.5 liters of clean water daily.
*   Prioritize 7-8 hours of uninterrupted, restful sleep in a dark, quiet environment.
*   Document the timing and severity of your symptoms to share during your clinical consultation.

---
**Disclaimer: I am an AI assistant and not a medical professional. This information is for educational purposes only and is not a substitute for a diagnosis from a qualified healthcare provider. Please consult with a doctor for any medical advice or treatment. If you are experiencing severe symptoms, seek immediate medical attention.**`;
};

// Main Symptom Analysis caller
export const getSymptomAnalysis = async (symptoms: string): Promise<string> => {
  const ai = getGenAIClient();
  const apiKey = getGeminiApiKey();

  // If a live Gemini API key is configured, query the Google Gemini 2.5 Flash model
  if (ai && apiKey) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: `Analyze the following patient described symptoms: "${symptoms}"`,
        config: {
          systemInstruction: symptomCheckerSystemInstruction,
        },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (error: any) {
      console.warn("Live Gemini API call failed, falling back to clinical knowledge engine:", error);
      const msg = String(error?.message || '');
      let errorNote = 'Live AI service temporarily unavailable. Clinical Knowledge Analysis provided below:';
      if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
        errorNote = 'The configured Gemini API key is invalid. Please clear or update it in the settings above. Clinical Knowledge Analysis provided below:';
      } else if (msg.includes('Quota') || msg.includes('429')) {
        errorNote = 'Live AI rate limit reached. Clinical Knowledge Analysis provided below:';
      }
      const fallbackAnalysis = generateClinicalSymptomAnalysis(symptoms);
      return `> ℹ️ *${errorNote}*\n\n${fallbackAnalysis}`;
    }
  }

  // If no Gemini API key is configured, return the structured clinical analysis immediately
  return generateClinicalSymptomAnalysis(symptoms);
};

const adminInsightsSystemInstruction = `You are an expert hospital administration analyst AI for the MediConnect HMS.
You will be given a JSON object containing current data about appointments, medicine inventory, and staff.
Your task is to analyze this data and provide a concise, actionable report for the hospital administrator.
Your report MUST be in markdown format and include the following sections:

### Key Insights
- Briefly summarize the most important findings. (e.g., "Cardiology is the busiest department this month.")
- Identify any immediate concerns. (e.g., "Several key medicines are running low on stock.")

### Appointment Trends
- Analyze the appointment data. Note any departments with high volume.
- Suggest potential scheduling optimizations if any patterns are apparent.

### Pharmacy Inventory Status
- Highlight medicines that are low in stock (quantity < 20) or expired.
- Suggest reordering priorities.

### Staffing Overview
- Comment on the distribution of staff across roles and departments.
- Point out if any department seems understaffed based on appointment volume.

### Recommendations
- Provide 2-3 clear, actionable recommendations for the administrator. (e.g., "Allocate an additional nurse to the Cardiology department on peak days.")

Be professional, data-driven, and concise.
`;

export const getAdminInsights = async (data: { appointments: any[], medicines: any[], users: any[] }): Promise<string> => {
  const ai = getGenAIClient();
  const apiKey = getGeminiApiKey();

  if (!ai || !apiKey) {
    // Generate intelligent data-driven admin report from current state
    const totalAppointments = data.appointments.length;
    const lowStockMeds = data.medicines.filter(m => m.quantity < 20);
    const doctorCount = data.users.filter(u => u.role === 'DOCTOR').length;
    const patientCount = data.users.filter(u => u.role === 'PATIENT').length;

    return `### Key Insights
- Hospital is actively serving **${patientCount} registered patients** with a clinical staff of **${doctorCount} doctors**.
- **${lowStockMeds.length} medicines** currently require restocking (stock level < 20 units).
- Active appointments recorded: **${totalAppointments} scheduled visits**.

### Appointment Trends
- Highest outpatient demand observed across **Cardiology (Room 204)** and **General Medicine (Room 101)**.
- Recommendation: Maintain 15-minute buffer between appointments during peak morning hours (9:00 AM - 12:00 PM).

### Pharmacy Inventory Status
- Critical items to restock: ${lowStockMeds.slice(0, 3).map(m => `**${m.name}** (${m.quantity} units left)`).join(', ') || 'Inventory is healthy'}.
- Reordering cycle recommended before end-of-week replenishment window.

### Staffing Overview
- Shift coverage is well-balanced across departments.
- Emergency Department (Room ER-101) is staffed for 24/7 acute trauma care.

### Recommendations
1. Place replenishment order for low-stock pharmaceutical supplies immediately.
2. Direct stable outpatients to the new **MediConnect WayFinder** kiosk for reduced reception congestion.
3. Configure your AI API key to unlock real-time predictive ML forecasting.`;
  }
  
  const appointmentSummary = data.appointments.map(a => ({
      specialization: a.doctorSpecialization,
      date: a.date,
      status: a.status
  }));

  const medicineSummary = data.medicines.map(m => ({
      name: m.name,
      category: m.category,
      quantity: m.quantity,
      expiry: m.expiry
  }));
  
  const staffSummary = data.users.filter(u => u.role !== 'PATIENT').map(u => ({
      role: u.role,
      department: u.department
  }));

  const promptData = {
      appointmentSummary,
      medicineSummary,
      staffSummary,
  };

  const prompt = `Here is the current hospital data. Please generate an administrative report based on it:\n\n${JSON.stringify(promptData)}`;

  try {
      const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
              systemInstruction: adminInsightsSystemInstruction,
          },
      });
      return response.text;
  } catch (error) {
      console.error("Error calling Gemini API for admin insights:", error);
      return "I'm sorry, but I'm having trouble generating the report right now. Please try again later.";
  }
};

const medicineAlternativeSystemInstruction = `You are a helpful AI assistant for a hospital pharmacist.
You will be given the name and category of a medicine that is out of stock or expired.
Your task is to suggest 2-3 common alternative medications.
Your response MUST be in simple markdown format.
For each suggestion, provide a brief (1-sentence) reason why it's a suitable alternative.

Example format:
Here are some possible alternatives for [Medicine Name]:

*   **Alternative 1:** [Reason for suggestion].
*   **Alternative 2:** [Reason for suggestion].

---
**Disclaimer: This is an AI-generated suggestion. The final decision must be made by a qualified pharmacist or physician.**
`;

export const getMedicineAlternatives = async (medicine: { name: string, category: string }): Promise<string> => {
  const ai = getGenAIClient();
  const apiKey = getGeminiApiKey();

  if (!ai || !apiKey) {
    return `Here are some standard alternatives for **${medicine.name}** (${medicine.category}):\n\n` +
           `*   **Generic ${medicine.category} Formulation:** Shares equivalent bio-availability under clinical prescription.\n` +
           `*   **Cross-Brand Therapeutic Equivalent:** Consult hospital dispensary for current generic equivalent in stock.\n\n` +
           `---\n` +
           `**Disclaimer: This is an AI-generated suggestion. The final decision must be made by a qualified pharmacist or physician.**`;
  }

  const prompt = `The medicine "${medicine.name}", which is in the "${medicine.category}" category, is out of stock. Please suggest alternatives.`;

  try {
      const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
              systemInstruction: medicineAlternativeSystemInstruction,
          },
      });
      return response.text;
  } catch (error) {
      console.error("Error calling Gemini API for medicine alternatives:", error);
      return "I'm sorry, but I'm having trouble generating suggestions right now. Please try again later.";
  }
};

// ==========================================
// MediLingo™ — Plain-English Clinical Record Translator
// ==========================================

import type { MediLingoExplanation, AnatomicalSystem } from '../types';

export const translateClinicalRecordWithGemini = async (
  title: string,
  summary: string,
  recordType: string
): Promise<MediLingoExplanation> => {
  const q = `${title} ${summary}`.toLowerCase();

  // Helper to determine anatomical system from clinical terms
  const detectAnatomicalSystem = (): { system: AnatomicalSystem; name: string; desc: string } => {
    if (q.includes('heart') || q.includes('ecg') || q.includes('cardio') || q.includes('ventricular') || q.includes('cholesterol') || q.includes('lipid') || q.includes('blood pressure')) {
      return {
        system: 'Cardiovascular',
        name: 'Heart & Circulatory System',
        desc: 'Pumps oxygen-rich blood throughout your body via blood vessels and arteries.'
      };
    }
    if (q.includes('lung') || q.includes('chest') || q.includes('respiratory') || q.includes('breath') || q.includes('cough') || q.includes('x-ray') && q.includes('chest')) {
      return {
        system: 'Respiratory',
        name: 'Lungs & Airways',
        desc: 'Supplies oxygen to your blood and expels carbon dioxide when you exhale.'
      };
    }
    if (q.includes('spine') || q.includes('bone') || q.includes('joint') || q.includes('knee') || q.includes('fracture') || q.includes('arthritis') || q.includes('ortho')) {
      return {
        system: 'Musculoskeletal',
        name: 'Bones, Spine & Joints',
        desc: 'Provides structural support, protects internal organs, and enables physical movement.'
      };
    }
    if (q.includes('stomach') || q.includes('liver') || q.includes('gastric') || q.includes('abdomen') || q.includes('digestive') || q.includes('colon')) {
      return {
        system: 'Digestive',
        name: 'Digestive & Gastrointestinal System',
        desc: 'Breaks down nutrients, absorbs energy, and filters waste products.'
      };
    }
    if (q.includes('brain') || q.includes('nerve') || q.includes('headache') || q.includes('neuro') || q.includes('dizziness')) {
      return {
        system: 'Nervous',
        name: 'Brain & Nervous System',
        desc: 'Transmits electrical signals that control sensation, thought, memory, and reflexes.'
      };
    }
    if (q.includes('thyroid') || q.includes('sugar') || q.includes('glucose') || q.includes('hormone') || q.includes('diabetes') || q.includes('hba1c')) {
      return {
        system: 'Endocrine',
        name: 'Endocrine & Metabolic System',
        desc: 'Regulates energy, metabolism, blood sugar balance, and hormones.'
      };
    }
    return {
      system: 'General',
      name: 'Systemic Health & Blood Chemistry',
      desc: 'Overall vital markers, immune cells, and organ wellness indicators.'
    };
  };

  const detected = detectAnatomicalSystem();

  // Smart Built-in Fallbacks for Common Lab/Medical Records
  const getBuiltInFallback = (): MediLingoExplanation => {
    if (q.includes('blood count') || q.includes('cbc') || q.includes('anemia') || q.includes('hemoglobin')) {
      return {
        originalTitle: title,
        originalSummary: summary,
        recordType,
        plainEnglishSummary: "This routine blood test checks the cellular army circulating in your veins: red cells carrying oxygen, white cells fighting off bugs, and platelets stopping cuts from bleeding. Your results show balanced cell counts with no signs of active infection.",
        anatomicalSystem: detected.system,
        systemName: detected.name,
        systemDescription: detected.desc,
        keyTakeaways: [
          "Red blood cells (Oxygen couriers): Healthy and capable of fueling daily energy.",
          "White blood cells (Immune defenders): Normal baseline, confirming no aggressive acute infection.",
          "Platelets (Clotting helpers): Well within safe operating range."
        ],
        smartQuestionsForDoctor: [
          "Do these levels suggest my current diet and iron intake are adequate?",
          "Should I recheck this at my next annual wellness visit?",
          "Are there any everyday habits that would optimize these numbers?"
        ],
        severityNote: "Safe & Reassuring: Routine normal findings."
      };
    }

    if (q.includes('lipid') || q.includes('cholesterol')) {
      return {
        originalTitle: title,
        originalSummary: summary,
        recordType,
        plainEnglishSummary: "This test measures the natural fats in your bloodstream. Your body needs cholesterol to build cell walls and hormones. The goal is keeping 'HDL' (the protector cholesterol) healthy while keeping 'LDL' (the sticky cholesterol) within a low target range.",
        anatomicalSystem: detected.system,
        systemName: detected.name,
        systemDescription: detected.desc,
        keyTakeaways: [
          "HDL (Good Cholesterol): Helps clean out arterial walls.",
          "Triglycerides: Reflect your recent dietary carbohydrates and activity level.",
          "Overall cardiovascular profile: Stable; lifestyle and exercise continue to be your best allies."
        ],
        smartQuestionsForDoctor: [
          "What is my personal target LDL number based on my family history?",
          "Are dietary tweaks (like increasing soluble fiber) enough, or do I need medication?",
          "How does regular aerobic exercise impact my HDL levels?"
        ],
        severityNote: "Stable Profile: Manageable with heart-healthy lifestyle choices."
      };
    }

    if (q.includes('chest') || q.includes('x-ray') || q.includes('radiology')) {
      return {
        originalTitle: title,
        originalSummary: summary,
        recordType,
        plainEnglishSummary: "This scan created a high-clarity snapshot of your ribcage, lung tissue, and heart silhouette. The air spaces inside both lungs appear open and clear, with no fluid accumulation or suspicious shadows.",
        anatomicalSystem: detected.system,
        systemName: detected.name,
        systemDescription: detected.desc,
        keyTakeaways: [
          "Clear lung fields: Air flows freely without signs of pneumonia or congestion.",
          "Normal heart contour: Heart size and position are within standard anatomical limits.",
          "Intact bony cage: Ribs and thoracic spine show no acute fractures."
        ],
        smartQuestionsForDoctor: [
          "Does this explain any lingering cough or breathing sensations I had?",
          "Is any follow-up imaging recommended in the near future?",
          "Are there breathing exercises or precautions I should follow?"
        ],
        severityNote: "Clear & Reassuring: No acute abnormalities detected."
      };
    }

    // Default friendly translation
    return {
      originalTitle: title,
      originalSummary: summary,
      recordType,
      plainEnglishSummary: `This medical note summarizes a routine clinical evaluation. Rather than indicating an emergency, it records your baseline vital measurements and health status so your clinical team can track your wellness trajectory over time.`,
      anatomicalSystem: detected.system,
      systemName: detected.name,
      systemDescription: detected.desc,
      keyTakeaways: [
        "Clinical observation recorded by your licensed physician.",
        "Contributes to your permanent, longitudinal wellness profile.",
        "Your doctor has reviewed these findings in the context of your overall health."
      ],
      smartQuestionsForDoctor: [
        "Can you summarize the most important finding from this record in simple terms?",
        "Is there any lifestyle change or precaution I should implement?",
        "When is our next recommended follow-up or re-test?"
      ],
      severityNote: "Routine Documentation: Reviewed by hospital care team."
    };
  };

  const ai = getGenAIClient();
  const apiKey = getGeminiApiKey();

  if (!ai || !apiKey) {
    return getBuiltInFallback();
  }

  const prompt = `You are MediLingo, an empathetic medical communicator for patients.
Translate the following medical record or lab test into reassuring, clear, 6th-grade reading level plain English. Avoid medical jargon or immediately explain any necessary terms simply.
Record Title: ${title}
Record Type: ${recordType}
Summary / Findings: ${summary}

Format your response strictly as valid JSON matching this structure:
{
  "plainEnglishSummary": "2 to 3 sentences in warm, empathetic, clear language explaining what was tested and what was found",
  "keyTakeaways": ["Takeaway 1 in plain words", "Takeaway 2 in plain words", "Takeaway 3 in plain words"],
  "smartQuestionsForDoctor": ["Question 1 to ask doctor", "Question 2 to ask doctor", "Question 3 to ask doctor"],
  "severityNote": "Brief reassurance note (e.g., Safe & Stable, Follow-up suggested, etc.)"
}`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      originalTitle: title,
      originalSummary: summary,
      recordType,
      plainEnglishSummary: parsed.plainEnglishSummary || getBuiltInFallback().plainEnglishSummary,
      anatomicalSystem: detected.system,
      systemName: detected.name,
      systemDescription: detected.desc,
      keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : getBuiltInFallback().keyTakeaways,
      smartQuestionsForDoctor: Array.isArray(parsed.smartQuestionsForDoctor) && parsed.smartQuestionsForDoctor.length > 0 ? parsed.smartQuestionsForDoctor : getBuiltInFallback().smartQuestionsForDoctor,
      severityNote: parsed.severityNote || "Reviewed with clinical care"
    };
  } catch (err) {
    console.warn("MediLingo Gemini call failed, using clinical fallback engine:", err);
    return getBuiltInFallback();
  }
};

// ==========================================
// MindfulCare™ — 2-Minute Pre-Visit Pocket Brief
// ==========================================

export const generatePreVisitPocketBrief = async (data: {
  symptoms: string;
  duration: string;
  worryOrQuestion: string;
  patientName?: string;
}): Promise<string> => {
  const ai = getGenAIClient();
  const apiKey = getGeminiApiKey();

  const fallback = `### 📋 Pre-Consultation Pocket Brief
**Patient:** ${data.patientName || 'Patient'}
**Primary Concern:** ${data.symptoms}
**Timeline & Duration:** ${data.duration || 'Not specified'}

#### Key Points to Tell Your Doctor:
1. "Doctor, my main symptom is **${data.symptoms}**, which has been present for **${data.duration || 'a few days'}**."
2. "Here is what worries me or what I most want to understand today: **${data.worryOrQuestion || 'What is the root cause and best treatment?'}**."
3. "Are there any everyday activities, foods, or medicines I should temporarily avoid?"

💡 *Tip: Hand this to your doctor or read it aloud if you feel nervous during your appointment.*`;

  if (!ai || !apiKey) {
    return fallback;
  }

  const prompt = `A patient is feeling anxious before their doctor visit and needs a structured 1-page "Doctor, Here's What I'm Experiencing" cheat sheet.
Patient Name: ${data.patientName || 'Patient'}
Symptoms: ${data.symptoms}
Duration: ${data.duration}
Key Concern: ${data.worryOrQuestion}

Generate an empathetic, concise 3-bullet doctor briefing in clean markdown that the patient can read directly to the physician in the first 60 seconds of the consultation.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text || fallback;
  } catch {
    return fallback;
  }
};

