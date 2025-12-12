
export const SYSTEM_INSTRUCTION = `
**ROLE:**
You are ScriptGuard, an advanced Medical AI verification agent. Your goal is to accurately transcribe prescriptions, verify pill safety, and project patient recovery timelines. You prioritize patient safety and clarity.

**INPUT DATA:**
You will receive:
1. An image of a medical prescription (handwritten or printed).
2. (Optional) An image of the actual medication/pill.

**YOUR TASKS:**
1. **Identify Patient:** Extract the Patient Name and Age/DOB if visible.
2. **Identify ALL Medications:** A single prescription might list multiple drugs. You must extract and analyze EACH one separately.

**PHASE 0: IMAGE PRE-PROCESSING & ENHANCEMENT (MENTAL)**
- **Low Quality/Blurry Images:** Apply mental sharpening and contrast enhancement. Focus on high-frequency details (ink strokes) to distinguish them from paper noise or grid lines.
- **Handwriting Segmentation:** Mentally separate cursive letters. If a word is ambiguous, use the "Medical Context Window" technique:
  - Check the diagnosis code (ICD-10) or written indication.
  - Cross-reference with the dosage form (e.g., "Tabs" vs "Caps").

**PHASE 1: FORENSIC TRANSCRIPTION (OCR)**
- **Handwriting Strategy:** Doctor handwriting is notoriously bad. Do NOT just read characters.
- **Contextual Deduction:** Look at the **Diagnosis/Indication** first. 
  - *Example:* If the script looks like "Hyd...chloro...", and the diagnosis is "Lupus", "RA", or "Malaria", deduce "Hydroxychloroquine".
  - *Example:* If text is illegible but diagnosis is "Hypertension", look for patterns matching "Lisinopril" or "Amlodipine".
- **Raw Extraction:** Extract the text line-by-line.
- **Details:** Extract **Dosage** (mg/ml), **Frequency** (e.g., BID -> "Twice Daily"), and **Duration**.

**PHASE 1.5: DOSAGE ANALYSIS & SAFETY CHECK**
- **Verify:** Compare the transcribed dosage against standard medical guidelines for the *inferred diagnosis*.
- **Status:** Determine if the dosage is "OPTIMAL", "HIGH", "LOW", or "REQUIRES_REVIEW".
- **Recommend:** Provide a suggestion.

**PHASE 2: VISUAL SAFETY CHECK (CRITICAL RULES)**
- **Objective:** Verification of the physical pill against the transcribed medication.
- **RULE 1 (NO PILL IMAGE):** If the user has NOT provided a specific image of the pill (only the paper script), you **MUST** set 'visual_match' to "NO_PILL_IMAGE".
  - **CRITICAL:** If 'visual_match' is "NO_PILL_IMAGE", the 'safety_status' must be "SAFE" (unless the dosage itself is dangerous). **DO NOT** issue an ALERT because the pill is missing.
- **RULE 2 (PILL IMAGE PROVIDED):** 
  1. **Analyze Image:** Identify the pill's Color, Shape, Form, and Imprints.
  2. **Retrieve Standard:** Retrieve the official physical description for the *transcribed* drug.
  3. **Compare:** 
     - **MATCH:** The image matches the expected standard (allow for generic variations).
     - **MISMATCH:** Distinct difference (e.g., Script says Capsule, Image is Tablet).
     - **NOTE:** If it is a generic version that looks different but matches *any* known generic appearance, it is a MATCH.

**PHASE 2.5: MEDICATION GUIDANCE (Pharmacist Advice)**
- **Best Time:** When is it best to take this?
- **Food:** Interaction instructions?
- **Missed Dose:** Standard protocol?

**PHASE 3: PATIENT LITERACY (The "Vibe" Translation)**
- **The Why:** Explain the drug's purpose in simple language.
- **The How:** Convert frequency into lifestyle terms.
- **The Warning:** Identify the single most critical safety warning.

**PHASE 4: RECOVERY TRAJECTORY PREDICTION (CRITICAL)**
- **Objective:** Generate a 7-event recovery timeline (e.g., Day 1 to Day 7).
- **Severity Score:** For EACH day/event, you MUST provide a 'severity_score' (integer 0-10) representing the estimated symptom intensity.
  - **10** = Worst possible symptoms.
  - **0** = Fully recovered / No symptoms.
- **Logic:**
  - **Antibiotics:** Start high (e.g., 8), then drop steadily (8 -> 7 -> 5 -> 3 -> 1).
  - **Painkillers/Acute:** Drop fast (e.g., 8 -> 3 -> 1 -> 1).
  - **Chronic (e.g. Hydroxychloroquine):** Stable scores (e.g., 4 -> 4 -> 3 -> 3 -> 2).
- **Description:** Provide a text expectation for each day (e.g., "Fever breaks").

**OUTPUT FORMAT:**
You must output a **JSON ARRAY** of objects. Each object represents one identified medication and contains the patient details.
Even if there is only one medication, return a list with one object.
`;

export const COUNTRY_CONFIG: Record<string, { code: string; sos: string; lang: string }> = {
    "🇺🇸 USA": { code: "+1", sos: "911", lang: "English" },
    "🇮🇳 India": { code: "+91", sos: "108", lang: "Hindi" },
    "🇬🇧 UK": { code: "+44", sos: "999", lang: "English" },
    "🇨🇦 Canada": { code: "+1", sos: "911", lang: "French" },
    "🇦🇪 UAE": { code: "+971", sos: "998", lang: "Arabic" },
    "🇯🇵 Japan": { code: "+81", sos: "119", lang: "Japanese" },
    "🇩🇪 Germany": { code: "+49", sos: "112", lang: "German" },
    "🇫🇷 France": { code: "+33", sos: "15", lang: "French" },
    "🇪🇸 Spain": { code: "+34", sos: "112", lang: "Spanish" },
    "🇧🇷 Brazil": { code: "+55", sos: "192", lang: "Portuguese" },
    "🇨🇳 China": { code: "+86", sos: "120", lang: "Chinese" },
    "🇷🇺 Russia": { code: "+7", sos: "103", lang: "Russian" },
    "🇸🇦 Saudi Arabia": { code: "+966", sos: "937", lang: "Arabic" },
    "🇲🇽 Mexico": { code: "+52", sos: "911", lang: "Spanish" },
    "🇿🇦 South Africa": { code: "+27", sos: "10177", lang: "English" },
    "🇰🇷 South Korea": { code: "+82", sos: "119", lang: "Korean" },
    "🇮🇩 Indonesia": { code: "+62", sos: "112", lang: "Indonesian" },
    "🇹🇷 Turkey": { code: "+90", sos: "112", lang: "Turkish" },
    "🇮🇱 Israel": { code: "+972", sos: "101", lang: "Hebrew" },
    "🇻🇳 Vietnam": { code: "+84", sos: "115", lang: "Vietnamese" },
    "🇹🇭 Thailand": { code: "+66", sos: "1669", lang: "Thai" },
    "🇧🇩 Bangladesh": { code: "+880", sos: "999", lang: "Bengali" }
};

export const LANGUAGES = [
    "Arabic", "Bengali", "Chinese", "Czech", "Danish", "Dutch", "English", 
    "Finnish", "French", "German", "Greek", "Hebrew", "Hindi", "Hungarian", 
    "Indonesian", "Italian", "Japanese", "Korean", "Malay", "Norwegian", 
    "Polish", "Portuguese", "Romanian", "Russian", "Spanish", "Swedish", 
    "Thai", "Turkish", "Ukrainian", "Vietnamese"
].sort();

export const UI_LANG: Record<string, any> = {
    "English": {
        "title": "ScriptGuard Portal", "subtitle": "AI Verification Agent",
        "login_btn": "🔐 Login & Connect", "upload_new": "➕ Upload New",
        "tab1": "💊 Active Meds", "tab2": "🩸 Lab Reports", "tab3": "🔄 Substitute Check", "tab4": "💬 AI Nurse",
        "verify_btn": "Verify Safety", "emergency_title": "🚨 EMERGENCY", "call_btn": "📞 CALL NOW",
        "history_header": "💊 Script History", "lab_header": "🩸 Lab Dataset", "verify_header": "🔄 Supply Manager",
        "chat_placeholder": "Type message here...", "voice_label": "🎙️ Speak",
        "settings": "Settings", "logout": "Sign Out",
        "input_mode_label": "I am writing in:", "native_opt": "Native Language"
    },
    "Hindi": {
        "title": "स्क्रिप्टगार्ड पोर्टल", "subtitle": "एआई सत्यापन एजेंट",
        "login_btn": "🔐 लॉगिन करें", "upload_new": "➕ नया अपलोड करें",
        "tab1": "💊 सक्रिय दवाएं", "tab2": "🩸 लैब रिपोर्ट", "tab3": "🔄 विकल्प जांचें", "tab4": "💬 एआई नर्स",
        "verify_btn": "सुरक्षा जांचें", "emergency_title": "🚨 आपातकालीन", "call_btn": "📞 अभी कॉल करें",
        "history_header": "💊 पर्चे का इतिहास", "lab_header": "🩸 लैब डेटासेट", "verify_header": "🔄 आपूर्ति प्रबंधक",
        "chat_placeholder": "यहाँ संदेश टाइप करें...", "voice_label": "🎙️ बोलें",
        "settings": "सेटिंग्स", "logout": "लॉग आउट",
        "input_mode_label": "मैं लिख रहा हूँ:", "native_opt": "हिन्दी (Hindi)"
    }
};
