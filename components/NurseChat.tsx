
import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Send, Bot, User, Loader2, Image as ImageIcon, X, Siren, Mic, Square, Volume2, AlertCircle, PhoneCall, Languages, Globe } from 'lucide-react';
import { ChatMessage, ScriptGuardResponse, RecoveryMetric } from '../types';
import { chatWithNurse } from '../services/geminiService';
import { UI_LANG, LANGUAGES } from '../constants';

interface NurseChatProps {
  medications: ScriptGuardResponse[];
  onRecoveryUpdate: (metric: RecoveryMetric) => void;
  patientBaseline?: string;
  language: string;
  emergencyPhoneNumber?: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onNotify: (type: 'SMS' | 'EMAIL', msg: string) => void;
}

const NurseChat: React.FC<NurseChatProps> = ({ 
  medications, 
  onRecoveryUpdate, 
  patientBaseline, 
  language, 
  emergencyPhoneNumber,
  messages,
  setMessages,
  onNotify
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [urgencyAlert, setUrgencyAlert] = useState(false);
  
  // Input Mode State: 'Native' implies using the prop 'language', 'English' implies English.
  // If prop 'language' is English, this toggle is redundant but harmless (we handle it in UI).
  const [inputMode, setInputMode] = useState<'Native' | 'English'>('Native');

  // Sync if prop changes (reset to Native default when user language changes)
  useEffect(() => {
    setInputMode('Native');
  }, [language]);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>("audio/webm");
  const [permissionError, setPermissionError] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const isMounted = useRef<boolean>(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper for UI Text specifically for chat component
  const getChatUiText = (key: string) => {
    const langKey = language === 'Hindi' || language === 'हिन्दी (Hindi)' ? 'Hindi' : 'English';
    return UI_LANG[langKey]?.[key] || UI_LANG['English'][key];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, urgencyAlert]);
  
  // Check for urgency in latest message to restore state on remount or updates
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'model' && lastMsg.isEmergency) {
        setUrgencyAlert(true);
      } else {
        setUrgencyAlert(false);
      }
    }
  }, [messages]);

  // Track mount status to prevent state updates on unmounted component
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Manage Audio URL lifecycle
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioUrl(null);
    }
  }, [audioBlob]);

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      cleanupAudioResources();
    };
  }, []);

  const cleanupAudioResources = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result && isMounted.current) {
          setSelectedImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Audio Functions
  const startRecording = async () => {
    if (isRecording || isInitializing) return;

    setPermissionError(false);
    setIsInitializing(true);
    setAudioBlob(null);
    setRecordingDuration(0);
    
    // 1. Check Browser Support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Audio recording is not supported in this browser.");
      if (isMounted.current) setIsInitializing(false);
      return;
    }

    try {
      // 2. Request Permission
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMounted.current) {
        // If unmounted during request, cleanup immediately
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      
      // 3. Determine Supported MIME Type
      // Prioritize formats supported by both Browser and AI if possible
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
        "audio/wav"
      ];
      
      let selectedMimeType = "";
      for (const type of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log(`Audio recording using MIME type: ${type}`);
          break;
        }
      }
      
      // 4. Setup MediaRecorder
      const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // Use the actual resolved mime type from the recorder if available, otherwise fallback
      const actualMimeType = mediaRecorder.mimeType || selectedMimeType || "audio/webm";
      if (isMounted.current) setAudioMimeType(actualMimeType);

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped. Processing chunks...");
        // Explicitly use the determined mime type for the blob
        const blob = new Blob(chunks, { type: actualMimeType });
        
        if (isMounted.current) {
           if (blob.size > 0) {
             setAudioBlob(blob);
           }
           setIsRecording(false);
        }
        
        // Stop stream tracks immediately to release mic
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      // 5. Start with timeslice to ensure data availability
      mediaRecorder.start(200);
      
      if (isMounted.current) {
        setIsRecording(true);
        setIsInitializing(false);
      }
      
      // Start Timer
      timerRef.current = window.setInterval(() => {
        if (isMounted.current) {
           setRecordingDuration(prev => prev + 1);
        }
      }, 1000);

    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      cleanupAudioResources();
      if (isMounted.current) setIsInitializing(false);
      
      const errorMessage = err.message || String(err);
      
      // Robust check for various permission denied errors
      const isPermissionDenied = 
        err.name === 'NotAllowedError' || 
        err.name === 'PermissionDeniedError' || 
        errorMessage.toLowerCase().includes('permission denied') ||
        errorMessage.toLowerCase().includes('permission');

      if (isPermissionDenied) {
        if (isMounted.current) setPermissionError(true);
      } else if (err.name === 'NotFoundError') {
        alert("No microphone device found.");
      } else {
        alert("Could not access microphone: " + errorMessage);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Logic continues in onstop handler
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setRecordingDuration(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
           // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
           const base64 = result.split(',')[1];
           resolve(base64);
        } else {
           reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage && !audioBlob) || loading) return;

    let imageBase64 = null;
    if (selectedImage) {
      imageBase64 = selectedImage.split(',')[1];
    }

    let audioBase64 = null;
    let mimeTypeToSend = undefined;
    
    if (audioBlob) {
      try {
        audioBase64 = await blobToBase64(audioBlob);
        // Ensure we send the correct MIME type that was used for recording
        mimeTypeToSend = audioBlob.type || audioMimeType;
      } catch (err) {
        console.error("Audio conversion failed:", err);
        alert("Failed to process audio recording.");
        return;
      }
    }

    const userMsg: ChatMessage = {
      role: 'user',
      text: input || (audioBlob ? "Sent an audio note" : "Sent an image"),
      image: imageBase64 || undefined,
      audio: audioBase64 || undefined,
      audioMimeType: mimeTypeToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    clearImage();
    clearAudio();
    setLoading(true);
    setUrgencyAlert(false);
    
    // Determine effective languages for API
    // If inputMode is English -> User types English, Bot responds in English (consistency)
    // If inputMode is Native -> User types Native, Bot responds in Native
    const activeLanguage = inputMode === 'English' ? 'English' : language;

    try {
      const response = await chatWithNurse(
        medications, 
        messages, 
        input, 
        imageBase64, 
        audioBase64, 
        mimeTypeToSend,
        patientBaseline,
        activeLanguage, // Use active language for response
        inputMode // Pass 'English' or 'Native' to help AI context
      );
      
      let displayText = response;
      let isEmergency = false;
      let emergencyReason = undefined;
      let metricData = null;
      
      try {
        const parsed = JSON.parse(response);
        if (parsed.message && (typeof parsed.severity === 'number' || parsed.severity === null || parsed.severity === 0)) {
           displayText = parsed.message;
           metricData = parsed;
        } else {
           displayText = parsed.message || JSON.stringify(parsed);
        }
      } catch (e) {
        // Fallback parsing logic for partial/markdown wrapped JSON
        if (response.includes("|||")) {
          const parts = response.split("|||");
          const jsonPart = parts[0];
          displayText = parts.slice(1).join("|||").trim(); 
          try {
             const jsonStr = jsonPart.replace(/JSON_DATA:/gi, "").replace(/```json/gi, "").replace(/```/g, "").trim();
             metricData = JSON.parse(jsonStr);
          } catch (err) {
             console.warn("Separator found but JSON parsing failed:", err);
          }
        } else {
          const jsonMatch = response.match(/^[\s\S]*?\{[\s\S]*?"severity"[\s\S]*?\}[\s\S]*?/);
          if (jsonMatch) {
               const potentialJson = jsonMatch[0];
               try {
                  const cleanMatch = potentialJson.replace(/```json/g, '').replace(/```/g, '').replace(/JSON_DATA:/i, '').trim();
                  const lastBrace = cleanMatch.lastIndexOf('}');
                  if (lastBrace !== -1) {
                     const strictJson = cleanMatch.substring(cleanMatch.indexOf('{'), lastBrace + 1);
                     metricData = JSON.parse(strictJson);
                     displayText = response.substring(response.indexOf(strictJson) + strictJson.length).trim();
                     if (displayText.startsWith("|||")) displayText = displayText.substring(3).trim();
                  }
               } catch (err) {
                  console.warn("Regex JSON fallback failed:", err);
               }
          }
        }
      }

      // Process Metric Data if found
      if (metricData) {
        if (typeof metricData.severity === 'number') {
          onRecoveryUpdate({
            day: 'Now', 
            severity: metricData.severity
          });
        }
        if (metricData.urgency && metricData.urgency.toLowerCase() === 'high') {
          setUrgencyAlert(true);
          isEmergency = true;
          emergencyReason = metricData.emergency_reason || "Critical symptoms detected.";
          
          // Send notification!
          onNotify("SMS", `EMERGENCY DETECTED: ${emergencyReason || 'Critical Symptoms'}`);
        }
      }

      const aiMsg: ChatMessage = {
        role: 'model',
        text: displayText,
        timestamp: Date.now(),
        isEmergency,
        emergencyReason
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        role: 'model',
        text: "I'm having trouble connecting. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px] relative">
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between transition-colors duration-300 ${urgencyAlert ? 'bg-red-600' : 'bg-gradient-to-r from-teal-500 to-emerald-600'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            {urgencyAlert ? <Siren className="w-6 h-6 text-white animate-pulse" /> : <Bot className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h3 className="font-bold text-white">{urgencyAlert ? "HIGH URGENCY DETECTED" : "Nurse Bot"}</h3>
            <p className="text-teal-100 text-xs">{urgencyAlert ? "Tone/Text analysis indicates distress" : `Monitoring ${medications.length} active medications`}</p>
          </div>
        </div>
        
        {urgencyAlert && emergencyPhoneNumber && (
           <a 
             href={`tel:${emergencyPhoneNumber}`}
             className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-sm shadow-lg animate-pulse hover:scale-105 transition-transform flex items-center gap-2"
           >
             <PhoneCall className="w-4 h-4 fill-current" />
             CALL {emergencyPhoneNumber}
           </a>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative">
        {/* Permission Error Banner */}
        {permissionError && (
          <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-800 p-3 text-sm flex items-center justify-between z-10 border-b border-red-200 animate-in slide-in-from-top">
             <div className="flex items-center gap-2">
               <AlertCircle className="w-4 h-4" />
               <span>Microphone access denied. Please allow permissions in your browser settings.</span>
             </div>
             <button onClick={() => setPermissionError(false)} className="text-red-600 hover:text-red-900"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Emergency Alert Banner Overlay */}
        {urgencyAlert && emergencyPhoneNumber && (
          <div className="sticky top-0 z-20 mx-auto w-full max-w-sm mb-4">
             <div className="bg-red-500 text-white p-4 rounded-xl shadow-xl border-2 border-white/20 text-center animate-bounce-in">
                <div className="flex justify-center mb-2">
                   <Siren className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold mb-1">EMERGENCY DETECTED</h3>
                <p className="text-xs text-red-100 mb-3">AI detected signs of distress or critical symptoms.</p>
                <a 
                   href={`tel:${emergencyPhoneNumber}`}
                   className="block w-full bg-white text-red-600 py-3 rounded-lg font-bold text-lg hover:bg-red-50 transition-colors shadow-md"
                >
                   📞 CALL {emergencyPhoneNumber} NOW
                </a>
             </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isUser ? 'bg-indigo-100 text-indigo-600' : 'bg-teal-100 text-teal-600'}`}>
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="flex flex-col gap-1">
                   {msg.image && (
                     <div className={`p-2 rounded-lg ${isUser ? 'bg-indigo-50' : 'bg-teal-50'} mb-1`}>
                       <img src={`data:image/jpeg;base64,${msg.image}`} alt="Attachment" className="max-w-full h-auto rounded-lg max-h-48 object-cover" />
                     </div>
                   )}
                   {msg.audio && (
                     <div className={`p-2 rounded-lg ${isUser ? 'bg-indigo-50' : 'bg-teal-50'} mb-1 flex items-center gap-2`}>
                       <Volume2 className="w-4 h-4 text-slate-500" />
                       <audio controls src={`data:${msg.audioMimeType || 'audio/webm'};base64,${msg.audio}`} className="h-8 w-48" />
                     </div>
                   )}
                   <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                     isUser 
                       ? 'bg-indigo-600 text-white rounded-tr-none' 
                       : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm'
                   }`}>
                     {msg.text}
                   </div>
                   <span className={`text-[10px] text-slate-400 ${isUser ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
             <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                   <span className="text-sm text-slate-500">Nurse is thinking...</span>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex flex-col gap-2">
           
           {/* Language Toggle: Show only if native language is NOT English */}
           {language !== 'English' && (
             <div className="flex items-center gap-3 mb-2 px-1">
                <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                  <Globe className="w-3 h-3" />
                  <span>Input Mode:</span>
                </div>
                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                   <button 
                     type="button"
                     onClick={() => setInputMode('Native')}
                     className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${inputMode === 'Native' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {language}
                   </button>
                   <button 
                     type="button"
                     onClick={() => setInputMode('English')}
                     className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${inputMode === 'English' ? 'bg-white text-teal-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     English
                   </button>
                </div>
             </div>
           )}

           {/* Attachments Preview */}
           {(selectedImage || audioBlob) && (
             <div className="flex gap-2 pb-2">
               {selectedImage && (
                 <div className="relative inline-block">
                   <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                   <button onClick={clearImage} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               )}
               {audioBlob && (
                 <div className="relative flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                   <Volume2 className="w-4 h-4 text-slate-500" />
                   <span className="text-xs font-semibold text-slate-700">Audio Recorded ({formatTime(recordingDuration)})</span>
                   <button onClick={clearAudio} className="ml-2 text-slate-400 hover:text-red-500">
                     <X className="w-4 h-4" />
                   </button>
                   {audioUrl && <audio src={audioUrl} className="hidden" />}
                 </div>
               )}
             </div>
           )}

           <form onSubmit={handleSend} className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                title="Attach Image"
                disabled={loading}
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageSelect} 
              />
              
              {isRecording ? (
                 <button 
                  type="button" 
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 animate-pulse"
                 >
                   <Square className="w-4 h-4 fill-current" />
                   <span className="text-xs font-bold w-12 text-center">{formatTime(recordingDuration)}</span>
                 </button>
              ) : (
                 <button 
                  type="button" 
                  onClick={startRecording}
                  disabled={loading || !!audioBlob}
                  className={`p-2 rounded-full transition-colors ${audioBlob ? 'text-slate-300' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                  title="Record Audio"
                 >
                   <Mic className="w-5 h-5" />
                 </button>
              )}

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={inputMode === 'English' ? UI_LANG['English']['chat_placeholder'] : `Type in ${language} (or phonetically)...`}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-full px-4 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage && !audioBlob) || loading || isRecording}
                className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:scale-105"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
              </button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default NurseChat;
