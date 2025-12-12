
import { ScriptGuardResponse, ScriptArchive, ScriptRecord } from '../types';

const STORAGE_KEYS = {
  SCRIPTS: 'scriptguard_db',
  BASELINE: 'scriptguard_baseline'
};

export const loadScripts = (): ScriptArchive => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SCRIPTS);
    if (!data) return {};

    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return {};

    const normalized: ScriptArchive = {};

    // Backward Compatibility: Migrate old array-only format to new ScriptRecord object
    Object.keys(parsed).forEach(key => {
      const item = parsed[key];
      
      if (Array.isArray(item)) {
        // Migration: Wrap old array in new object structure
        normalized[key] = {
          data: item,
          notes: [],
          timestamp: Date.now()
        };
      } else if (item && typeof item === 'object' && 'data' in item) {
        // Already in new format
        normalized[key] = item as ScriptRecord;
      }
    });

    return normalized;
  } catch (e) {
    console.error("Failed to load scripts", e);
    return {};
  }
};

export const saveScript = (key: string, data: ScriptGuardResponse[]): ScriptArchive => {
  const current = loadScripts();
  
  // Create new record structure
  const newRecord: ScriptRecord = {
    data: data,
    notes: [],
    timestamp: Date.now()
  };

  const updated = { ...current, [key]: newRecord };
  
  try {
    localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save script", e);
  }
  return updated;
};

export const addScriptNote = (key: string, note: string): ScriptArchive => {
  const current = loadScripts();
  if (current[key]) {
    // Create deep copy of the specific record to mutate
    const updatedRecord = { 
      ...current[key], 
      notes: [...current[key].notes, note] 
    };
    
    const updatedArchive = { ...current, [key]: updatedRecord };
    try {
      localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(updatedArchive));
      return updatedArchive;
    } catch (e) {
      console.error("Failed to save note", e);
    }
  }
  return current;
};

export const deleteScript = (key: string): ScriptArchive => {
  try {
    const current = loadScripts();
    // Create a new object reference to ensure React state picks up changes
    const updated = { ...current };
    
    if (updated[key]) {
      delete updated[key];
      localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    console.error("Failed to delete script", e);
    return loadScripts(); 
  }
};

export const loadBaseline = (): string => {
  return localStorage.getItem(STORAGE_KEYS.BASELINE) || "";
};

export const saveBaseline = (baseline: string): void => {
  localStorage.setItem(STORAGE_KEYS.BASELINE, baseline);
};

export const clearAllStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SCRIPTS);
    localStorage.removeItem(STORAGE_KEYS.BASELINE);
  } catch (e) {
    console.error("Failed to clear storage", e);
  }
};
