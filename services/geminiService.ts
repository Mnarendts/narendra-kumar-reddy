
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { ScriptGuardResponse, ChatMessage, SubstituteAnalysis, CabinetScanResult, LabAnalysis } from "../types";

// Define the schema for a SINGLE medication object
const singleMedicationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    patient_details: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Name of the patient listed on the script" },
        age_or_dob: { type: Type.STRING, description: "Age or Date of Birth if visible" }
      },
      required: ["name", "age_or_dob"]
    },
    safety_status: {
      type: Type.STRING,
      enum: ["SAFE", "ALERT"],
      description: "Overall safety status. Set to ALERT ONLY if a visual mismatch is confirmed OR dosage is dangerous. If NO_PILL_IMAGE, set to SAFE."
    },
    raw_script_extraction: {
      type: Type.STRING,
      description: "The raw text extracted from the image line-by-line."
    },
    transcription: {
      type: Type.OBJECT,
      properties: {
        drug_name: { type: Type.STRING },
        generic_name: { type: Type.STRING, description: "The scientific/generic name of the drug" },
        dosage_strength: { type: Type.STRING },
        frequency_translated: { type: Type.STRING },
        diagnosis_inferred: { type: Type.STRING },
        duration_days: { type: Type.NUMBER, description: "Estimated course duration in days. Default to 7 if unknown." }
      },
      required: ["drug_name", "generic_name", "dosage_strength", "frequency_translated", "diagnosis_inferred", "duration_days"]
    },
    dosage_analysis: {
      type: Type.OBJECT,
      properties: {
        status: { 
          type: Type.STRING, 
          enum: ["OPTIMAL", "HIGH", "LOW", "REQUIRES_REVIEW"] 
        },
        standard_range: { type: Type.STRING },
        recommendation: { type: Type.STRING }
      },
      required: ["status", "standard_range", "recommendation"]
    },
    medication_guidance: {
      type: Type.OBJECT,
      properties: {
        best_time_to_take: { type: Type.STRING, description: "E.g., With breakfast and dinner" },
        food_interaction: { type: Type.STRING, description: "E.g., Take with food, avoid dairy" },
        missed_dose_logic: { type: Type.STRING, description: "Action to take if a dose is forgotten" }
      },
      required: ["best_time_to_take", "food_interaction", "missed_dose_logic"]
    },
    pill_verification: {
      type: Type.OBJECT,
      properties: {
        visual_match: {
          type: Type.STRING,
          enum: ["MATCH", "MISMATCH", "NO_PILL_IMAGE"]
        },
        reasoning: { type: Type.STRING, description: "Detailed visual analysis. If MISMATCH, explain exactly why. If no pill image provided, explain standard appearance." },
        details: {
          type: Type.OBJECT,
          properties: {
            color: { type: Type.STRING },
            shape: { type: Type.STRING },
            imprint: { type: Type.STRING, description: "Letters or numbers stamped on the pill" },
            scoring: { type: Type.STRING, description: "Description of break lines on the pill" },
            logo_description: { type: Type.STRING, description: "Description of any logos or symbols" }
          },
          required: ["color", "shape", "imprint", "scoring", "logo_description"]
        }
      },
      required: ["visual_match", "reasoning", "details"]
    },
    patient_literacy_card: {
      type: Type.OBJECT,
      properties: {
        purpose_simplified: { type: Type.STRING },
        critical_warning: { type: Type.STRING }
      },
      required: ["purpose_simplified", "critical_warning"]
    },
    recovery_timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          status: { type: Type.STRING },
          expectation: { type: Type.STRING },
          severity_score: { 
            type: Type.NUMBER, 
            description: "Estimated symptom severity score (0-10) for this day. 10 is worst, 0 is fully recovered." 
          }
        },
        required: ["day", "status", "expectation", "severity_score"]
      }
    }
  },
  required: [
    "patient_details",
    "safety_status", 
    "raw_script_extraction",
    "transcription", 
    "dosage_analysis", 
    "medication_guidance",
    "pill_verification", 
    "patient_literacy_card", 
    "recovery_timeline"
  ]
};

// The main response schema is now an ARRAY of medications
const responseSchema: Schema = {
  type: Type.ARRAY,
  items: singleMedicationSchema
};

const verifySubstituteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ["APPROVED", "CAUTION", "REJECTED"] },
    reason: { type: Type.STRING },
    dosage_adjustment: { type: Type.STRING },
    visual_check: { type: Type.STRING }
  },
  required: ["status", "reason", "dosage_adjustment", "visual_check"]
};

const shelfScanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shelf_inventory: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of all medication names identified on the shelf."
    },
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          shelf_drug: { type: Type.STRING },
          conflict_reason: { type: Type.STRING },
          action: { type: Type.STRING, description: "Action to take, e.g., 'Discard', 'Store separately'" }
        },
        required: ["shelf_drug", "conflict_reason", "action"]
      },
      description: "List of conflicting medications found on the shelf."
    },
    safe_items: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of items on the shelf that are safe or unrelated to active medications."
    }
  },
  required: ["shelf_inventory", "conflicts", "safe_items"]
};

const labAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    patient_name_detected: { type: Type.STRING, nullable: true },
    report_date: { type: Type.STRING, nullable: true },
    summary: { type: Type.STRING, description: "A concise executive summary of the patient's health status based on the labs." },
    abnormalities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          test_name: { type: Type.STRING },
          measured_value: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["HIGH", "LOW", "CRITICAL", "ABNORMAL"] },
          significance: { type: Type.STRING, description: "Why is this concerning? What does it imply?" }
        },
        required: ["test_name", "measured_value", "status", "significance"]
      }
    },
    key_vitals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          metric: { type: Type.STRING, description: "e.g., Creatinine, Hemoglobin, Glucose" },
          value: { type: Type.STRING },
          unit: { type: Type.STRING }
        },
        required: ["metric", "value", "unit"]
      },
      description: "Extract 5-10 key baseline metrics even if they are normal."
    }
  },
  required: ["summary", "abnormalities", "key_vitals"]
};

const chatResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    severity: { type: Type.INTEGER, description: "Symptom severity score (0-10). 0 if no symptoms/normal. 10 is critical/worst." },
    urgency: { type: Type.STRING, enum: ["high", "normal"] },
    emergency_reason: { type: Type.STRING, nullable: true },
    message: { type: Type.STRING, description: "The nurse's response message to the patient." }
  },
  required: ["severity", "urgency", "message"]
};

const getAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set the API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to clean JSON text that might be wrapped in markdown
const cleanJsonText = (text: string): string => {
  let cleaned = text.trim();
  // Remove markdown wrapping if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
};

export const createPatientBaseline = async (
  historyImagesBase64: string[],
  language: string = "English"
): Promise<string> => {
  const ai = getAIClient();
  
  const parts: any[] = [
    { text: `Analyze these medical history documents/images. Create a concise PATIENT BASELINE SUMMARY. Focus on chronic conditions, normal baseline levels for vitals/bloodwork, and known allergies. Write the summary in ${language}.` }
  ];

  historyImagesBase64.forEach(base64 => {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { role: "user", parts },
    });
    return response.text || "No baseline could be generated.";
  } catch (error) {
    console.error("Baseline Generation Failed:", error);
    throw error;
  }
};

export const analyzeLabReport = async (
  filesBase64: string[],
  language: string = "English"
): Promise<LabAnalysis> => {
  const ai = getAIClient();
  
  const parts: any[] = [
    { text: `
    Act as a Pathologist. Analyze these Lab Reports (Images). 
    1. Summarize Abnormalities.
    2. Establish Baseline.
    3. Output summary in ${language}.
    4. Output strictly in JSON format matching the schema.
    ` }
  ];

  filesBase64.forEach(base64 => {
      parts.push({
          inlineData: { mimeType: "image/jpeg", data: base64 }
      });
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { role: "user", parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: labAnalysisSchema,
        temperature: 0.2
      }
    });

    const text = response.text || "{}";
    const cleanedText = cleanJsonText(text);
    return JSON.parse(cleanedText) as LabAnalysis;
  } catch (error) {
    console.error("Lab Analysis Failed:", error);
    throw error;
  }
}

export const analyzeMedicalData = async (
  prescriptionImageBase64: string,
  pillImageBase64: string | null,
  audioBase64: string | null,
  patientBaseline: string | null,
  language: string = "English"
): Promise<ScriptGuardResponse[]> => {
  const ai = getAIClient();

  // Dynamically build the prompt based on available data to reduce hallucination
  let pillInstruction = "";
  if (pillImageBase64) {
    pillInstruction = "A PILL IMAGE IS PROVIDED. Perform a rigorous visual verification against the transcribed medication. Identify shape, color, and IMPRINT CODES (alphanumeric text). If the physical pill features do not match the transcribed drug's standard description, mark as MISMATCH.";
  } else {
    pillInstruction = "NO PILL IMAGE IS PROVIDED. You MUST set 'visual_match' to 'NO_PILL_IMAGE' and 'safety_status' to 'SAFE' (unless the dosage itself is dangerous). Do NOT hallucinate a visual mismatch.";
  }

  const parts: any[] = [
    { text: `
      Analyze this prescription image with ADVANCED MEDICAL FORENSICS.
      
      [CRITICAL] PATIENT LAB DATA & HISTORY:
      ${patientBaseline ? patientBaseline : "No specific lab data provided. Assume average patient parameters."}
      
      STEP 1: IMAGE RESTORATION & OCR ENHANCEMENT (MENTAL)
      - Low Quality/Blur Handling: Apply mental sharpening filters to high-frequency details (ink strokes).
      - Contrast Normalization: Distinguish faint blue/black ink from paper grain or shadows.
      - Handwriting Reconstruction: If handwriting is illegible, use "Probabilistic Medical Inference":
        1. Identify the 'Diagnosis/Indication' first (e.g., "HTN", "Infection").
        2. Filter potential drug candidates that match the diagnosis.
        3. Match the visible ink patterns (ascenders/descenders like 'l', 't', 'g', 'y') against those candidates.
      
      STEP 2: PRECISE EXTRACTION
      - Identify ALL medications listed.
      - Extract: Drug Name, GENERIC NAME, Dosage Strength, Frequency, Duration.
      - Normalization: Convert "QD", "BID", "TID" into clear frequency instructions.
      
      STEP 3: LAB-INTEGRATED SAFETY CHECK (MANDATORY)
      You MUST cross-reference the extracted medication against the specific [PATIENT LAB DATA] provided above.
      
      1. **CONTRAINDICATIONS:**
         - Check for specific conflicts (e.g., Prescribing NSAIDs if Creatinine is High/Kidney Failure).
         - Check for Electrolyte imbalances (e.g., Prescribing ACE Inhibitors if Potassium is High).
      
      2. **DOSAGE ADJUSTMENTS (Renal/Hepatic):**
         - If the lab report indicates **Low GFR** or **High Creatinine**, verify if the drug requires **Renal Dosing**.
         - If the prescribed dose is standard but the patient's labs show organ impairment, flag this immediately.
      
      3. **ACTION LOGIC:**
         - If a Lab Conflict is found:
           - Set 'safety_status' to 'ALERT'.
           - Set 'dosage_analysis.status' to 'REQUIRES_REVIEW'.
           - In 'dosage_analysis.recommendation', WRITE IN CAPS: "LAB SAFETY WARNING: Patient's [Lab Metric] is [Value]. This drug may require dosage adjustment or is contraindicated."

      STEP 4: PILL VERIFICATION (VISUAL ANALYSIS)
      - ${pillInstruction}
      - Visual Algorithm:
        1. Segmentation: Isolate the pill from the background.
        2. Feature Extraction: Determine Shape (Round, Oval, Capsule), Color (taking lighting into account), and Imprint (Alphanumeric codes).
        3. Comparison: Strictly compare extracted features against the pharmaceutical standard for the transcribed drug.
        4. Tolerance: Allow for minor lighting variations, but flag shape/imprint mismatches as ALERT.

      STEP 5: AUDIO/CONTEXT INTEGRATION
      - If an audio note is provided, use it to refine the analysis (e.g., patient says "for my heart" -> prioritizes cardiac meds).
      
      STEP 6: FINAL OUTPUT GENERATION
      - Return a JSON LIST of objects. 
      - CRITICAL: Translate 'instructions' (frequency_translated), 'warnings' (critical_warning), 'visual_standard' (reasoning) into ${language}.
    ` }
  ];

  parts.push({
    inlineData: {
      mimeType: "image/jpeg",
      data: prescriptionImageBase64
    }
  });

  if (pillImageBase64) {
    parts.push({ text: "Here is the pill image for verification:" });
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: pillImageBase64
      }
    });
  }

  if (audioBase64) {
    parts.push({ text: "AUDIO NOTE ATTACHED: Use this for additional context." });
    parts.push({
        inlineData: {
            mimeType: "audio/webm",
            data: audioBase64
        }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        role: "user",
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + `\n\nIMPORTANT: The user's preferred language is ${language}. Ensure all generated text (excluding field names) is in ${language}.`,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1 // Lowered temperature for stricter adherence to rules
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const cleanedText = cleanJsonText(text);
    const data = JSON.parse(cleanedText);

    // Robust handling: Ensure it is always an array
    if (Array.isArray(data)) {
      return data as ScriptGuardResponse[];
    } else {
      return [data] as ScriptGuardResponse[];
    }
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};

export const chatWithNurse = async (
  medications: ScriptGuardResponse[],
  history: ChatMessage[],
  userMessage: string,
  userImageBase64?: string | null,
  userAudioBase64?: string | null,
  userAudioMimeType?: string,
  patientBaseline?: string,
  language: string = "English",
  inputMode: 'English' | 'Native' = 'English'
): Promise<string> => {
  const ai = getAIClient();

  // Create a summary of current medications to feed as context
  const medSummary = medications.map(med => 
    `- ${med.transcription.drug_name} (${med.transcription.dosage_strength}): Used for ${med.transcription.diagnosis_inferred}. Schedule: ${med.transcription.frequency_translated}. Critical Warning: ${med.patient_literacy_card.critical_warning}`
  ).join("\n");

  const systemInstruction = `
    You are 'ScriptGuard Nurse', an empathetic and vigilant medical assistant.
    
    CONTEXT:
    1. CURRENT MEDICATIONS (From Cabinet):
    ${medSummary}

    2. PATIENT LAB DATA / BASELINE (CRITICAL):
    ${patientBaseline || "No lab data provided. Assume average patient profile."}
    
    INSTRUCTION: If the patient lab data contains specific abnormalities (e.g., High Creatinine, Low Iron), USE THIS INFORMATION to provide highly specific advice.

    3. AUTOMATED TRANSLATION & LANGUAGE HANDLING (CRITICAL):
    - **TARGET PATIENT LANGUAGE:** ${language}
    - **INPUT MODE:** The user has indicated they are typing in ${inputMode === 'Native' ? language : 'English'}.
    - **YOUR JOB IS TO TRANSLATE & RESPOND:**
       - If the user writes in a language DIFFERENT from ${language}, internally translate it to understand the medical intent.
       - **ALWAYS** generate your response ('message' field) in **${language}**.
       - Do NOT reply in English if the user's preferred language is ${language}, even if they typed in English. Stick to the preference.

    YOUR DUTIES:
    1. Monitor Recovery: Encourage the patient if they are doing well.
    2. Check Interactions: If the user reports a new symptom, check if it could be a side effect or interaction between the drugs in their cabinet.
    3. Lab Context: Use the Patient Lab Data to answer questions (e.g., if kidney issues in lab, warn about ibuprofen).
    4. Safety First: If the patient reports severe symptoms (high fever, severe pain, difficulty breathing), advise them to seek professional help immediately.
    5. Multimodal Analysis:
       - IMAGES: Analyze thermometers, rashes, or wounds.
       - AUDIO: If audio is provided, listen to the TONE. Are they breathless, panicked, or slurring? If so, treat as HIGH URGENCY.

    OUTPUT FORMAT:
    Return a JSON object only.
    {
      "severity": integer (0-10),  // 0 if normal/no symptoms. 10 is critical.
      "urgency": "high" or "normal",
      "emergency_reason": string or null,
      "message": "Your response string to the user in ${language}"
    }
  `;

  // Format history for Gemini
  const contents = history.map(msg => {
    const parts: any[] = [];
    if (msg.text) parts.push({ text: msg.text });
    if (msg.image) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: msg.image
        }
      });
    }
    if (msg.audio) {
       parts.push({
        inlineData: {
          mimeType: msg.audioMimeType || "audio/webm",
          data: msg.audio
        }
      });
    }
    return { role: msg.role, parts };
  });

  // Add the new user message
  const currentParts: any[] = [];
  
  if (userMessage.trim()) {
    currentParts.push({ text: userMessage });
  }

  if (userImageBase64) {
    currentParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: userImageBase64
      }
    });
  }

  if (userAudioBase64) {
    // Explicitly add audio data
    currentParts.push({
      inlineData: {
        mimeType: userAudioMimeType || "audio/webm",
        data: userAudioBase64
      }
    });
    // Add instruction to prompt model to listen
    currentParts.push({ text: "USER AUDIO MESSAGE ATTACHED. Please listen to the tone (pain, urgency, confusion) and transcribe the intent." });
  }

  // Fallback if empty (shouldn't happen with UI checks, but safe)
  if (currentParts.length === 0) {
    currentParts.push({ text: "Checking in..." });
  }

  contents.push({
    role: "user",
    parts: currentParts
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: chatResponseSchema,
        temperature: 0.7 
      }
    });

    return response.text || '{"message": "I received your message, but I am having trouble processing the data. Please try again.", "severity": 0, "urgency": "normal"}';
  } catch (error) {
    console.error("Chat Failed:", error);
    return '{"message": "I apologize, but I\'m currently unable to process your request. Please check your connection.", "severity": 0, "urgency": "normal"}';
  }
};

export const checkSubstituteSafety = async (
  prescribed: ScriptGuardResponse,
  substituteName: string,
  substituteImageBase64: string | null,
  patientHistory: string,
  language: string = "English"
): Promise<SubstituteAnalysis> => {
  const ai = getAIClient();
  
  // OPTIMIZATION: Create a minimal representation of the prescribed drug to focus the AI
  // and avoid token limits or confusion from raw OCR text.
  const minimalPrescribed = {
      drug_name: prescribed.transcription.drug_name,
      generic_name: prescribed.transcription.generic_name,
      dosage: prescribed.transcription.dosage_strength,
      frequency: prescribed.transcription.frequency_translated,
      diagnosis: prescribed.transcription.diagnosis_inferred,
      warnings: prescribed.patient_literacy_card.critical_warning
  };
  
  const prescribedJson = JSON.stringify(minimalPrescribed);

  const parts: any[] = [
    { text: `
      Act as a Senior Clinical Pharmacist.
      TASK: Compare the 'Candidate Medicine' (Alternate) against the 'Prescribed Medicine' (Truth) to determine if it is a safe substitute.

      CONTEXT:
      1. PRESCRIBED MEDICINE: ${prescribedJson}
      2. CANDIDATE MEDICINE: ${substituteName}
      3. PATIENT PROFILE: ${patientHistory}

      ANALYSIS RULES:
      - **Active Ingredient:** Must match exactly or be a known equivalent (e.g. Ibuprofen = Advil).
      - **Dosage Safety:** Is the candidate's strength safe given the prescription?
      - **Contraindications:** Check the Patient Profile for allergies or conflicts.

      OUTPUT FORMAT (JSON ONLY):
      - status: "APPROVED" (Safe match), "CAUTION" (Same drug but different dose/form), or "REJECTED" (Different drug/Unsafe).
      - reason: Brief explanation in ${language}.
      - dosage_adjustment: Instructions for the candidate medicine (e.g. "Take 2 tablets instead of 1"). Translate to ${language}.
      - visual_check: If image provided, confirm it matches the candidate name. Translate to ${language}.
    `}
  ];

  if (substituteImageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: substituteImageBase64
      }
    });
    parts.push({ text: "Use this image to identify the Candidate Medicine." });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { role: "user", parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: verifySubstituteSchema,
        temperature: 0.1 // Lowered for consistency
      }
    });
    
    const text = response.text || "{}";
    const cleanedText = cleanJsonText(text);
    return JSON.parse(cleanedText) as SubstituteAnalysis;
  } catch (error) {
    console.error("Substitute Check Failed:", error);
    throw error;
  }
};

export const scanMedicineShelf = async (
  shelfImageBase64: string,
  activeMedications: ScriptGuardResponse[],
  language: string = "English"
): Promise<CabinetScanResult> => {
  const ai = getAIClient();
  
  // Create a summary of active medications for context
  const activeMedsSummary = activeMedications.map(med => 
    `- ${med.transcription.drug_name} (${med.transcription.dosage_strength}): ${med.transcription.diagnosis_inferred}`
  ).join("\n");

  const parts: any[] = [
    { text: `
      Act as a Clinical Pharmacist.
      TASK: Analyze this image of a medicine cabinet/shelf. Identify all visible medications.
      
      CONTEXT: The patient is currently taking the following ACTIVE MEDICATIONS:
      ${activeMedsSummary}
      
      YOUR GOAL:
      1. List ALL items found on the shelf (shelf_inventory).
      2. Identify CONFLICTS or DUPLICATES. 
         - Is there an expired version of an active med?
         - Is there a drug that interacts dangerously with an active med?
         - Is there a duplicate (e.g. "Brand name" vs "Generic")?
      3. List SAFE items (safe_items).

      LANGUAGE: Translate 'conflict_reason' and 'action' into ${language}.
      
      OUTPUT: JSON matching the schema.
    ` }
  ];

  parts.push({
    inlineData: {
      mimeType: "image/jpeg",
      data: shelfImageBase64
    }
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { role: "user", parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: shelfScanSchema,
        temperature: 0.2
      }
    });

    const text = response.text || "{}";
    const cleanedText = cleanJsonText(text);
    return JSON.parse(cleanedText) as CabinetScanResult;
  } catch (error) {
    console.error("Shelf Scan Failed:", error);
    throw error;
  }
};
