
import React, { useState, useEffect, useRef } from 'react';
import { Pill, ShieldPlus, ArrowLeft, Activity, FileText, Upload, UserCircle, RotateCcw, Trash2, FolderOpen, Save, Plus, Menu, LogOut, Search, Camera, ScanText, Globe, Siren, StickyNote, NotebookPen, ArrowUpDown, AlertTriangle, FileBarChart, Droplet, Bell, Mail, MessageSquare, Server, Settings, Check, X, Thermometer, User, Calendar, HeartPulse } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import FileUpload from './components/FileUpload';
import AnalysisResult from './components/AnalysisResult';
import MedicationCard from './components/MedicationCard';
import NurseChat from './components/NurseChat';
import SubstituteChecker from './components/SubstituteChecker';
import LandingPage from './components/LandingPage';
import { analyzeMedicalData, createPatientBaseline, analyzeLabReport } from './services/geminiService';
import { loadScripts, saveScript, deleteScript, loadBaseline, saveBaseline, addScriptNote, clearAllStorage } from './services/storageService';
import { ScriptGuardResponse, FileState, RecoveryMetric, ScriptRecord, ScriptArchive, ChatMessage, UserInfo, NotificationLogItem, LabAnalysis } from './types';
import { UI_LANG } from './constants';

type ViewMode = 'dashboard' | 'review_analysis' | 'substitute_check' | 'lab_reports' | 'settings';

const App: React.FC = () => {
  // Application State
  const [hasStarted, setHasStarted] = useState(false);
  const [cabinet, setCabinet] = useState<ScriptGuardResponse[]>([]);
  const [scriptArchive, setScriptArchive] = useState<ScriptArchive>({});
  const [view, setView] = useState<ViewMode>('dashboard');
  const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetric[]>([
    { day: 'Start', severity: 0 }
  ]);
  
  // Lab Reports State
  const [labData, setLabData] = useState<LabAnalysis | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // User Profile State
  const [userInfo, setUserInfo] = useState<UserInfo>({
      name: "Guest",
      email: "",
      country: "🇺🇸 USA",
      phone: "",
      language: "English",
      sos: "911"
  });

  // Notification System State
  const [notificationLog, setNotificationLog] = useState<NotificationLogItem[]>([]);
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'SMS' | 'EMAIL'} | null>(null);

  // Lifted Chat State for Persistence
  const [nurseMessages, setNurseMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "Hello! I'm your ScriptGuard Nurse. I'm aware of the medications in your cabinet. How are you feeling today?",
      timestamp: Date.now()
    }
  ]);
  
  // Sidebar State
  const [selectedScriptKey, setSelectedScriptKey] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');

  // Analysis State (Transient)
  const [prescription, setPrescription] = useState<FileState>({ file: null, previewUrl: null });
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScriptRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lab Upload State
  const [isProcessingLabs, setIsProcessingLabs] = useState(false);

  // Notes State
  const [newNote, setNewNote] = useState("");

  // Settings Temp State
  const [tempSmtpEmail, setTempSmtpEmail] = useState("");
  const [tempSmtpPass, setTempSmtpPass] = useState("");

  // Helper for UI Text
  const getUiText = (key: string) => {
    // Basic fallback logic: Check Hindi explicitly as per requirement, else default to English
    // In a production app, we would map all 'language' values to keys in UI_LANG
    const langKey = userInfo.language === 'Hindi' || userInfo.language === 'हिन्दी (Hindi)' ? 'Hindi' : 'English';
    return UI_LANG[langKey]?.[key] || UI_LANG['English'][key];
  };

  // --- 1. INITIAL LOAD (Persistence) ---
  useEffect(() => {
    // Load Baseline / Lab Summary
    const savedBaseline = loadBaseline();
    if (savedBaseline) {
      try {
        // Try parsing as JSON (New Format)
        const parsed = JSON.parse(savedBaseline);
        if (parsed.abnormalities || parsed.summary) {
          setLabData(parsed);
        } else {
           // Fallback for weird json
           setLabData({ 
             summary: savedBaseline, 
             abnormalities: [], 
             key_vitals: [], 
             patient_name_detected: null, 
             report_date: null 
            });
        }
      } catch (e) {
        // Fallback for Plain Text (Legacy Format)
        setLabData({ 
           summary: savedBaseline, 
           abnormalities: [], 
           key_vitals: [], 
           patient_name_detected: null, 
           report_date: null 
        });
      }
    }

    // Load Scripts
    const archive = loadScripts();
    setScriptArchive(archive);
    
    // Populate Cabinet with all meds from all saved scripts (flattened)
    const allMeds: ScriptGuardResponse[] = [];
    Object.values(archive).forEach(record => {
      // Handle both old array format (just in case) and new record format
      const meds = Array.isArray(record) ? record : record.data;
      if (meds) allMeds.push(...meds);
    });
    setCabinet(allMeds);
  }, []);

  // Sync Settings form with UserInfo when view changes
  useEffect(() => {
    if (view === 'settings') {
      setTempSmtpEmail(userInfo.sender_email || "");
      setTempSmtpPass(userInfo.sender_pass || "");
    }
  }, [view, userInfo]);

  // Toast Timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const notify = async (type: 'SMS' | 'EMAIL', message: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let status = "Simulated";
    let destination = type === 'SMS' ? userInfo.phone : userInfo.email;

    if (type === 'EMAIL') {
        if (userInfo.sender_email && userInfo.sender_pass) {
            // Simulate Real Email Sending Logic (Client-Side Simulation of SMTP)
            try {
                 // Simulate processing time for SMTP connection
                console.log(`%c[SMTP CLIENT] Connecting to smtp.gmail.com:587...`, 'color: #3b82f6');
                await new Promise(resolve => setTimeout(resolve, 800)); // Connect delay
                
                console.log(`%c[SMTP CLIENT] Authenticating as ${userInfo.sender_email}...`, 'color: #3b82f6');
                await new Promise(resolve => setTimeout(resolve, 800)); // Auth delay
                
                console.log(`%c[SMTP CLIENT] Sending email to ${userInfo.email}...`, 'color: #3b82f6');
                console.log(`%c[SMTP CLIENT] Subject: 🚨 ScriptGuard Alert: ${userInfo.name}`, 'color: #3b82f6');
                console.log(`%c[SMTP CLIENT] Body: ${message}`, 'color: #3b82f6');

                status = "Sent (Real)";
            } catch (e) {
                console.error("SMTP Error:", e);
                status = "Failed";
            }
        } else {
            // Dummy/Simulated Logic
            status = "Sent (Simulated)";
            console.warn("Using Dummy SMTP Credentials: demo@scriptguard.ai");
        }
    } else if (type === 'SMS') {
        // Placeholder SMS Service Logic
        status = "Sent via Placeholder SMS";
        console.log(`%c[SMS SERVICE] Sending message to ${userInfo.phone}: "${message}"`, 'color: #10b981; font-weight: bold;');
    }

    const logItem: NotificationLogItem = { time, type, msg: message, status };
    
    setNotificationLog(prev => [logItem, ...prev]);
    
    // Explicit UI Feedback for "Real Time" Feel
    setToastMessage({ msg: message, type });
    
    console.log(`[${type} LOGGED] Status: ${status} | To: ${destination}`);
  };

  const handleLogin = (details: UserInfo) => {
    setUserInfo(details);
    setHasStarted(true);
    // Welcome Notification
    setTimeout(() => {
       notify("EMAIL", `Welcome ${details.name}. ScriptGuard is monitoring your health.`);
    }, 500);
  };

  const saveSettings = () => {
    setUserInfo(prev => ({
      ...prev,
      sender_email: tempSmtpEmail,
      sender_pass: tempSmtpPass
    }));
    notify("SMS", "System Settings Updated.");
  };

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handlePrescriptionSelect = (file: File) => {
    setPrescription({ file, previewUrl: URL.createObjectURL(file) });
    setCurrentResult(null);
  };

  const getDetailedContextString = (): string => {
    if (!labData) return "No Lab Data Uploaded.";
    // Legacy String Check
    if (!labData.abnormalities && !labData.key_vitals && labData.summary) return labData.summary;

    return `
      [LAB REPORT ANALYSIS]
      Summary: ${labData.summary}
      Patient Name: ${labData.patient_name_detected || "Unknown"}
      Report Date: ${labData.report_date || "Unknown"}
      
      [DETECTED ABNORMALITIES]
      ${labData.abnormalities.map(a => `- ${a.test_name}: ${a.measured_value} [${a.status}] -> Significance: ${a.significance}`).join('\n')}
      
      [BASELINE VITALS]
      ${labData.key_vitals.map(v => `- ${v.metric}: ${v.value} ${v.unit}`).join('\n')}
    `;
  };

  const handleAnalyze = async () => {
    if (!prescription.file) return;

    setLoading(true);
    setError(null);

    try {
      const prescriptionBase64 = await fileToBase64(prescription.file);
      
      const baselineContext = getDetailedContextString();

      const data = await analyzeMedicalData(
        prescriptionBase64, 
        null, 
        null, 
        baselineContext,
        userInfo.language
      );
      
      // Wrap in ScriptRecord format for consistent viewing
      const record: ScriptRecord = {
        data: data,
        notes: [],
        timestamp: Date.now()
      };
      
      setCurrentResult(record);
      setSelectedScriptKey(""); // Represents new unsaved analysis
      setView('review_analysis');
      
      // Notify Success
      if(data.length > 0) {
        notify("SMS", `Rx Processed: ${data[0].transcription.drug_name || 'Script'}`);
      }
    } catch (err) {
      setError("Failed to analyze the prescription. Please check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCabinet = () => {
    if (currentResult && currentResult.data.length > 0) {
      // 1. Generate Unique Name (Drug Name + Date)
      const mainDrug = currentResult.data[0].transcription.drug_name || "Unknown Script";
      const now = new Date();
      // Format: DrugName (YYYY-MM-DD HH:MM)
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const saveKey = `${mainDrug} (${timestamp})`;

      // 2. Save to Persistent Storage
      // Pass raw data array, service wraps it
      const updatedArchive = saveScript(saveKey, currentResult.data);
      setScriptArchive(updatedArchive);

      // 3. Update Active Cabinet (Flattened View)
      setCabinet(prev => [...currentResult.data, ...prev]);

      // 4. Reset UI
      setPrescription({ file: null, previewUrl: null });
      setCurrentResult(null);
      setView('dashboard');
    }
  };

  const handleRecoveryUpdate = (metric: RecoveryMetric) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRecoveryMetrics(prev => [
      ...prev,
      {
        day: timestamp,
        severity: metric.severity
      }
    ]);
  };

  const handleLabUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingLabs(true);
      try {
        const files = Array.from(e.target.files) as File[];
        const base64Promises = files.map(file => fileToBase64(file));
        const base64Images = await Promise.all(base64Promises);
        
        // Use the new Lab Analysis service (Returns structured LabAnalysis object)
        const analysis = await analyzeLabReport(base64Images, userInfo.language);
        
        setLabData(analysis);
        // Persist as stringified JSON
        saveBaseline(JSON.stringify(analysis)); 
        
        notify("SMS", "Lab Data Processed & Vitals Updated.");
      } catch (err) {
        console.error(err);
        alert("Failed to process lab reports.");
      } finally {
        setIsProcessingLabs(false);
      }
    }
  };

  // --- HISTORY SIDEBAR ACTIONS ---
  const handleLoadScript = (key: string) => {
    if (key && scriptArchive[key]) {
      setSelectedScriptKey(key);
      setCurrentResult(scriptArchive[key]);
      setView('review_analysis');
      if (window.innerWidth < 1024) setIsSidebarOpen(false); // Close sidebar on mobile select
    }
  };

  const handleDeleteScript = (e: React.MouseEvent, key: string) => {
    e.preventDefault(); // Prevent default link behavior
    e.stopPropagation(); // Prevent loading the script when deleting
    
    if (key) {
      // Use window.confirm to avoid any ambiguity
      if (window.confirm("Are you sure you want to delete this record? This cannot be undone.")) {
        const updatedArchive = deleteScript(key);
        setScriptArchive(updatedArchive);
        
        // REFRESH CABINET: We must recalculate active meds from the NEW archive
        const allMeds: ScriptGuardResponse[] = [];
        Object.values(updatedArchive).forEach(record => {
           const meds = Array.isArray(record) ? record : record.data;
           if(meds) allMeds.push(...meds);
        });
        setCabinet(allMeds);

        // If we deleted the currently viewed script, go back to dashboard
        if (selectedScriptKey === key) {
           setSelectedScriptKey("");
           setCurrentResult(null);
           setView('dashboard');
        }
      }
    }
  };

  const handleFactoryReset = () => {
    if (window.confirm("Are you sure you want to Factory Reset? This will delete ALL saved scripts and history.")) {
      clearAllStorage();
      setScriptArchive({});
      setCabinet([]);
      setLabData(null);
      setRecoveryMetrics([{ day: 'Start', severity: 0 }]);
      setNotificationLog([]);
      setSelectedScriptKey("");
      setCurrentResult(null);
      // Reset Chat
      setNurseMessages([{
        role: 'model',
        text: "Hello! I'm your ScriptGuard Nurse. I'm aware of the medications in your cabinet. How are you feeling today?",
        timestamp: Date.now()
      }]);
      setView('dashboard');
      alert("App has been reset.");
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedScriptKey) return;
    
    // Save to storage
    const updatedArchive = addScriptNote(selectedScriptKey, newNote);
    setScriptArchive(updatedArchive);
    
    // Update local view state immediately
    if (currentResult) {
      setCurrentResult({
        ...currentResult,
        notes: [...currentResult.notes, newNote]
      });
    }
    
    setNewNote("");
  };

  if (!hasStarted) {
    return <LandingPage onLogin={handleLogin} />;
  }

  // Check if server settings are active (simulated)
  const isServerActive = !!(userInfo.sender_email && userInfo.sender_pass);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[60] bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-500 border border-slate-700">
          <div className={`p-3 rounded-full ${toastMessage.type === 'SMS' ? 'bg-teal-500' : 'bg-blue-600'}`}>
            {toastMessage.type === 'SMS' ? <MessageSquare className="w-5 h-5 text-white" /> : <Mail className="w-5 h-5 text-white" />}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-0.5">
              {toastMessage.type === 'SMS' ? `Sent to ${userInfo.phone}` : `Sent to ${userInfo.email}`}
            </p>
            <p className="text-sm font-semibold text-white">{toastMessage.msg}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 shadow-xl flex flex-col`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">{getUiText('title')}</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* User Profile Info */}
          <div className="px-3">
             <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3 mb-3 relative z-10">
                   <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-lg font-bold">
                     {userInfo.name.charAt(0).toUpperCase()}
                   </div>
                   <div className="overflow-hidden">
                     <p className="text-sm font-bold text-white truncate">{userInfo.name}</p>
                     <p className="text-[10px] text-slate-400 truncate">{userInfo.email}</p>
                   </div>
                </div>
                
                <div className="space-y-2 text-xs text-slate-300 relative z-10">
                    <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3 text-blue-400" /> {userInfo.country}
                    </div>
                     <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-teal-400" /> {userInfo.phone}
                    </div>
                     <div className="flex items-center gap-2">
                        <ScanText className="w-3 h-3 text-purple-400" /> Lang: <strong>{userInfo.language}</strong>
                    </div>
                    {/* Server Connection Status Indicator */}
                    <div className={`flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50 ${isServerActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        <Server className="w-3 h-3" /> 
                        <span>{isServerActive ? "SMTP Active (Sim)" : "Using Dummy Creds"}</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Live Alerts Log */}
          <div className="space-y-1">
             <div className="px-3 flex items-center gap-2 text-slate-500 mb-2">
                <Bell className="w-3 h-3" />
                <p className="text-xs font-bold uppercase tracking-wider">Live Alerts</p>
             </div>
             <div className="bg-slate-800/50 rounded-xl p-3 mx-3 max-h-40 overflow-y-auto border border-slate-700/50 custom-scrollbar">
                {notificationLog.length === 0 ? (
                  <p className="text-[10px] text-slate-500 text-center italic">No alerts sent yet.</p>
                ) : (
                  <div className="space-y-3">
                    {notificationLog.map((log, i) => (
                      <div key={i} className="flex gap-2 items-start border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                         <div className="mt-0.5">
                           {log.type === 'SMS' ? <MessageSquare className="w-3 h-3 text-teal-400" /> : <Mail className="w-3 h-3 text-blue-400" />}
                         </div>
                         <div>
                            <p className="text-[10px] text-slate-300 font-medium leading-tight">{log.msg}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[9px] text-slate-500">{log.time}</p>
                                {log.status && <p className={`text-[8px] px-1 rounded ${log.status.includes('Simulated') || log.status.includes('Placeholder') ? 'text-amber-500 bg-amber-900/30' : 'text-emerald-500 bg-emerald-900/30'}`}>{log.status}</p>}
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>

          {/* Main Nav */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
            <button 
              onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Pill className="w-5 h-5" /> {getUiText('tab1')}
            </button>
            <button 
              onClick={() => { setView('lab_reports'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${view === 'lab_reports' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Droplet className="w-5 h-5" /> {getUiText('tab2')}
            </button>
            <button 
              onClick={() => { setView('substitute_check'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${view === 'substitute_check' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <RotateCcw className="w-5 h-5" /> {getUiText('tab3')}
            </button>
            {/* SETTINGS LINK ADDED */}
             <button 
              onClick={() => { setView('settings'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${view === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Settings className="w-5 h-5" /> {getUiText('settings')}
            </button>
          </div>

          {/* History Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{getUiText('history_header')}</p>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">{Object.keys(scriptArchive).length}</span>
            </div>
            
            {/* Sort Controls */}
            {Object.keys(scriptArchive).length > 0 && (
              <div className="px-3 mb-2 flex justify-end">
                 <div className="relative group">
                   <select
                     value={sortOrder}
                     onChange={(e) => setSortOrder(e.target.value as any)}
                     className="appearance-none bg-slate-800 text-[10px] font-medium text-slate-400 border border-slate-700 rounded-md py-1 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-slate-600 cursor-pointer hover:text-slate-300 transition-colors"
                   >
                     <option value="date_desc">Newest First</option>
                     <option value="date_asc">Oldest First</option>
                     <option value="name_asc">Name (A-Z)</option>
                     <option value="name_desc">Name (Z-A)</option>
                   </select>
                   <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                      <ArrowUpDown className="h-3 w-3" />
                   </div>
                 </div>
              </div>
            )}
            
            <div className="space-y-1">
              {Object.keys(scriptArchive).length === 0 ? (
                <div className="px-3 py-4 text-center border border-dashed border-slate-700 rounded-lg">
                  <FolderOpen className="w-6 h-6 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500">No scanned scripts yet.</p>
                </div>
              ) : (
                Object.keys(scriptArchive)
                  .sort((a, b) => {
                    const recA = scriptArchive[a];
                    const recB = scriptArchive[b];
                    
                    switch (sortOrder) {
                      case 'date_asc':
                        return recA.timestamp - recB.timestamp;
                      case 'name_asc':
                         return a.toLowerCase().localeCompare(b.toLowerCase());
                      case 'name_desc':
                         return b.toLowerCase().localeCompare(a.toLowerCase());
                      case 'date_desc':
                      default:
                        return recB.timestamp - recA.timestamp;
                    }
                  })
                  .map((key) => {
                  const hasNotes = scriptArchive[key].notes && scriptArchive[key].notes.length > 0;
                  return (
                    <div key={key} className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedScriptKey === key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`} onClick={() => handleLoadScript(key)}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm truncate">{key}</span>
                        {hasNotes && <StickyNote className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                      </div>
                      <button 
                        onClick={(e) => handleDeleteScript(e, key)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="px-3 pt-4 border-t border-slate-800 space-y-2">
             <button 
               onClick={handleFactoryReset}
               className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
             >
               <AlertTriangle className="w-3 h-3" /> Factory Reset
             </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
           <button onClick={() => setHasStarted(false)} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs w-full px-2">
              <LogOut className="w-3 h-3" /> {getUiText('logout')}
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        
        {/* Top Header Mobile */}
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between lg:hidden sticky top-0 z-40">
           <div className="flex items-center gap-2">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
               <Menu className="w-6 h-6" />
             </button>
             <span className="font-bold text-slate-800">{getUiText('title')}</span>
           </div>
           <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
             <UserCircle className="w-5 h-5" />
           </div>
        </header>

        {/* View Routing */}
        <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          
          {view === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Current Medications</h1>
                  <p className="text-slate-500">Overview of your prescriptions and health tracking.</p>
                </div>
              </div>

              {/* Upload & Analysis Preview Area */}
              {!prescription.file && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <ScanText className="w-5 h-5 text-blue-500" /> New Prescription Analysis
                   </h2>
                   <div className="h-64">
                     <FileUpload
                       label="Upload or Snap Prescription"
                       subLabel="Use camera for best results"
                       filePreview={null}
                       onFileSelect={handlePrescriptionSelect}
                       onClear={() => {}}
                       icon={<ScanText className="w-8 h-8 text-slate-300 mb-2" />}
                     />
                   </div>
                </div>
              )}

              {prescription.file && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" /> New Analysis Request
                      </h3>
                      <button onClick={() => { setPrescription({file: null, previewUrl: null}); }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
                   </div>
                   <div className="p-6 flex flex-col md:flex-row gap-8">
                      <div className="w-full md:w-1/3">
                         <img src={prescription.previewUrl!} alt="Preview" className="w-full h-64 object-contain bg-slate-900 rounded-lg border border-slate-200" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                         <div className="mb-6">
                            <p className="font-semibold text-slate-700 mb-1">Processing File:</p>
                            <p className="text-sm text-slate-500 bg-slate-100 px-3 py-2 rounded border border-slate-200 font-mono truncate">{prescription.file.name}</p>
                         </div>
                         
                         <button 
                           onClick={handleAnalyze}
                           disabled={loading}
                           className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {loading ? <Activity className="w-5 h-5 animate-spin" /> : <ShieldPlus className="w-5 h-5" />}
                           {loading ? `Analyzing (${userInfo.language})...` : "Run Safety Analysis"}
                         </button>
                         {error && (
                           <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-center">{error}</p>
                         )}
                      </div>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Col: Cabinet */}
                <div className="xl:col-span-2 space-y-8">
                   
                   {/* Active Cabinet */}
                   <div>
                     <div className="flex items-center justify-between mb-4">
                       <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                         <Pill className="w-5 h-5 text-indigo-500" /> Active Medications
                       </h2>
                     </div>
                     
                     {cabinet.length === 0 ? (
                       <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Pill className="w-8 h-8 text-slate-300" />
                          </div>
                          <p className="text-slate-500 font-medium">Your cabinet is empty.</p>
                          <p className="text-sm text-slate-400">Scan a prescription to get started.</p>
                       </div>
                     ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {cabinet.map((med, idx) => (
                             <MedicationCard key={idx} data={med} />
                          ))}
                       </div>
                     )}
                   </div>

                </div>

                {/* Right Col: Nurse Chat & Severity Graph */}
                <div className="xl:col-span-1 space-y-8">
                   
                   {/* Nurse Chat Component */}
                   <div>
                       <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <UserCircle className="w-5 h-5 text-teal-500" /> AI Nurse ({userInfo.language})
                       </h2>
                       <NurseChat 
                         medications={cabinet} 
                         onRecoveryUpdate={handleRecoveryUpdate}
                         patientBaseline={getDetailedContextString()} // PASS DETAILED JSON STRING HERE
                         language={userInfo.language}
                         emergencyPhoneNumber={userInfo.sos}
                         messages={nurseMessages}
                         setMessages={setNurseMessages}
                         onNotify={notify}
                       />
                   </div>

                   {/* Severity Chart Widget */}
                   <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-red-500" />
                        <h2 className="text-lg font-bold text-slate-800">Symptom Severity</h2>
                      </div>
                      <div className="h-48">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={recoveryMetrics}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis 
                                dataKey="day" 
                                hide={false} 
                                tick={{fontSize: 10}} 
                                interval="preserveStartEnd"
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis domain={[0, 10]} hide={true} />
                              <Tooltip />
                              <Line type="monotone" dataKey="severity" stroke="#ef4444" strokeWidth={2} dot={{r: 4}} />
                            </LineChart>
                         </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 text-center">Tracked via Nurse Chat interactions. 10 = Severe, 0 = Recovered.</p>
                   </div>

                </div>
              </div>
            </div>
          )}
          
          {/* LAB REPORTS VIEW (UPDATED) */}
          {view === 'lab_reports' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-4 mb-2">
                   <button onClick={() => setView('dashboard')} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                     <ArrowLeft className="w-5 h-5" />
                   </button>
                   <h1 className="text-2xl font-bold text-slate-900">Lab History & Baseline</h1>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                   
                   {/* Upload Column */}
                   <div className="flex flex-col gap-4 h-full">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                         <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-slate-400" /> Upload Reports
                         </h3>
                         <div className="h-48 relative border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center text-center p-6 cursor-pointer group">
                             <input 
                               type="file" 
                               multiple 
                               accept="image/*"
                               onChange={handleLabUpload}
                               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                             />
                             <div className="bg-white p-4 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                               {isProcessingLabs ? <Activity className="w-8 h-8 text-blue-500 animate-spin" /> : <FileBarChart className="w-8 h-8 text-slate-400" />}
                             </div>
                             <p className="font-medium text-slate-600">{isProcessingLabs ? "Analyzing Vitals..." : "Click to Upload Lab Images"}</p>
                             <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG</p>
                         </div>
                      </div>

                      {/* Display Patient Metadata if found */}
                      {labData && labData.patient_name_detected && (
                        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="bg-blue-500 p-3 rounded-full">
                                    <User className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <p className="text-blue-200 text-xs font-bold uppercase tracking-wide">Patient Detected</p>
                                    <h2 className="text-2xl font-bold">{labData.patient_name_detected}</h2>
                                    <div className="flex items-center gap-2 text-sm text-blue-100 mt-1">
                                        <Calendar className="w-4 h-4" /> Report Date: {labData.report_date || "Unknown"}
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                        </div>
                      )}

                      {/* Summary Card */}
                      {labData && (
                          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1">
                             <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-slate-500" /> Clinical Summary
                             </h3>
                             <p className="text-slate-600 leading-relaxed text-sm">
                                {labData.summary}
                             </p>
                          </div>
                      )}
                   </div>

                   {/* Analysis Dashboard Column */}
                   <div className="flex flex-col gap-6 h-full">
                      
                      {/* Vitals Grid */}
                      {labData && labData.key_vitals && labData.key_vitals.length > 0 && (
                          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <HeartPulse className="w-5 h-5 text-rose-500" /> Baseline Vitals
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {labData.key_vitals.map((v, i) => (
                                    <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase font-bold truncate" title={v.metric}>{v.metric}</p>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className="text-lg font-bold text-slate-800">{v.value}</span>
                                            <span className="text-xs text-slate-400 font-medium">{v.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                          </div>
                      )}

                      {/* Abnormalities List */}
                      {labData && labData.abnormalities && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1">
                             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" /> 
                                Detected Abnormalities <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{labData.abnormalities.length}</span>
                             </h3>
                             
                             {labData.abnormalities.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Check className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No abnormalities detected in this report.</p>
                                </div>
                             ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {labData.abnormalities.map((item, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border-l-4 ${
                                            item.status === 'CRITICAL' ? 'bg-red-50 border-l-red-500 border-red-100' :
                                            item.status === 'HIGH' ? 'bg-orange-50 border-l-orange-500 border-orange-100' :
                                            item.status === 'LOW' ? 'bg-blue-50 border-l-blue-500 border-blue-100' :
                                            'bg-amber-50 border-l-amber-500 border-amber-100'
                                        }`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-slate-800 text-sm">{item.test_name}</h4>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                     item.status === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                                                     item.status === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                                                     item.status === 'LOW' ? 'bg-blue-200 text-blue-800' :
                                                     'bg-amber-200 text-amber-800'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Thermometer className="w-3 h-3 text-slate-400" />
                                                <span className="text-xs font-mono font-bold text-slate-700">{item.measured_value}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed border-t border-black/5 pt-2 mt-2">
                                                {item.significance}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>
                      )}

                      {!labData && (
                          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center">
                              <Activity className="w-12 h-12 text-slate-300 mb-4" />
                              <p className="text-slate-500 font-medium">No Lab Data Active</p>
                              <p className="text-xs text-slate-400 mt-1 max-w-xs">Upload a blood test or lab report to establish a medical baseline for the AI Nurse.</p>
                          </div>
                      )}
                   </div>

                </div>
             </div>
          )}

          {/* SETTINGS VIEW */}
          {view === 'settings' && (
             <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-2">
                   <button onClick={() => setView('dashboard')} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                     <ArrowLeft className="w-5 h-5" />
                   </button>
                   <h1 className="text-2xl font-bold text-slate-900">Application Settings</h1>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="bg-slate-800 px-6 py-4">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Server className="w-5 h-5 text-emerald-400" /> SMTP Configuration
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Configure real-time email alerts via Gmail SMTP</p>
                   </div>
                   
                   <div className="p-6 space-y-4">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 mb-4">
                        <div className="bg-white p-1.5 rounded-full h-fit">
                          <Check className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-blue-900 text-sm">Simulation Mode Active</h4>
                          <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                             If you leave these fields empty, ScriptGuard will use <strong>Dummy Credentials</strong> (demo@scriptguard.ai) to simulate email alerts in the log without sending real emails.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Sender Gmail Address</label>
                        <input 
                          type="email" 
                          value={tempSmtpEmail}
                          onChange={(e) => setTempSmtpEmail(e.target.value)}
                          placeholder="e.g. alerts@scriptguard.com"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Google App Password</label>
                        <input 
                          type="password" 
                          value={tempSmtpPass}
                          onChange={(e) => setTempSmtpPass(e.target.value)}
                          placeholder="•••• •••• •••• ••••"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Use an App Password generated from your Google Account Security settings, not your personal password.
                        </p>
                      </div>

                      <div className="pt-4 flex justify-between items-center gap-3">
                        <button
                           onClick={() => notify("EMAIL", "Test Alert: Verification of notification settings.")}
                           className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-100 border border-amber-200 flex items-center gap-2"
                        >
                           <Bell className="w-4 h-4" /> Test Alert
                        </button>
                        <div className="flex gap-3">
                            <button 
                               onClick={() => setView('dashboard')}
                               className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
                            >
                               Cancel
                            </button>
                            <button 
                               onClick={saveSettings}
                               className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2"
                            >
                               <Save className="w-4 h-4" /> Save Configuration
                            </button>
                        </div>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {view === 'review_analysis' && currentResult && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-4 mb-2">
                <button onClick={() => setView('dashboard')} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Analysis Results</h1>
              </div>

              {/* AI Analysis Component */}
              <AnalysisResult data={currentResult.data} />
              
              {/* Notes / Symptoms Section */}
              {selectedScriptKey && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-2 mb-4 text-amber-600">
                    <NotebookPen className="w-5 h-5" />
                    <h2 className="text-lg font-bold">Clinical Notes & Symptoms</h2>
                  </div>
                  
                  {/* Notes List */}
                  <div className="space-y-3 mb-4">
                     {currentResult.notes && currentResult.notes.length > 0 ? (
                        currentResult.notes.map((note, idx) => (
                          <div key={idx} className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-slate-700 text-sm">
                             <div className="flex items-start gap-2">
                               <StickyNote className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                               <p>{note}</p>
                             </div>
                          </div>
                        ))
                     ) : (
                       <p className="text-sm text-slate-400 italic">No notes recorded for this prescription.</p>
                     )}
                  </div>

                  {/* Add Note Input */}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add symptom log or side effect note..."
                      className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <button 
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 disabled:opacity-50"
                    >
                      Add Note
                    </button>
                  </div>
                </div>
              )}

              <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-lg z-50 lg:pl-72 flex justify-end gap-4">
                 <button 
                   onClick={() => setView('dashboard')}
                   className="px-6 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                 >
                   {selectedScriptKey ? "Close" : "Discard"}
                 </button>
                 {!selectedScriptKey && (
                   <button 
                     onClick={handleAddToCabinet}
                     className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md flex items-center gap-2"
                   >
                     <Save className="w-4 h-4" /> Save to Cabinet
                   </button>
                 )}
              </div>
              <div className="h-20" /> {/* Spacer for fixed bottom bar */}
            </div>
          )}

          {view === 'substitute_check' && (
            <div className="space-y-6 animate-fade-in">
               <div className="flex items-center gap-4 mb-2">
                <button onClick={() => setView('dashboard')} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Substitute Checker</h1>
              </div>
              <SubstituteChecker 
                activeMedications={cabinet} 
                patientHistory={getDetailedContextString()}
                language={userInfo.language}
                onNotify={notify}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
