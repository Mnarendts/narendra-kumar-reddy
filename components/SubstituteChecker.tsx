
import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle, Search, Camera, Pill, Ban, ExternalLink } from 'lucide-react';
import FileUpload from './FileUpload';
import { checkSubstituteSafety } from '../services/geminiService';
import { ScriptGuardResponse, SubstituteAnalysis } from '../types';

interface SubstituteCheckerProps {
  activeMedications: ScriptGuardResponse[];
  patientHistory?: string;
  language: string;
  onNotify: (type: 'SMS' | 'EMAIL', msg: string) => void;
}

const SubstituteChecker: React.FC<SubstituteCheckerProps> = ({ activeMedications, patientHistory = "", language, onNotify }) => {
  const [selectedMedIndex, setSelectedMedIndex] = useState<number>(0);
  const [altName, setAltName] = useState<string>('');
  const [altImage, setAltImage] = useState<{ file: File; preview: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubstituteAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setAltImage({ file, preview: URL.createObjectURL(file) });
    setResult(null);
    setError(null); // Clear error on new input
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const handleVerify = async () => {
    // Explicitly handle empty state with an error message instead of disabling the button
    if (!altName.trim() && !altImage) {
      setError("Please provide an alternate name or upload a photo.");
      return;
    }
    
    const prescribed = activeMedications[selectedMedIndex];
    if (!prescribed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const imageBase64 = altImage ? await fileToBase64(altImage.file) : null;
      const analysis = await checkSubstituteSafety(
        prescribed, 
        altName || "Unknown Alternate Image", 
        imageBase64, 
        patientHistory,
        language
      );
      setResult(analysis);
      
      // Notify result
      if(analysis.status === "APPROVED") {
        onNotify("SMS", `Safety Check: ${altName || 'Image'} APPROVED.`);
      }
    } catch (err) {
      console.error(err);
      setError("Verification failed. Please check inputs and try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedMed = activeMedications[selectedMedIndex];
  
  // Construct search URL for the candidate medicine
  const googleSearchUrl = altName ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(altName + " pill")}` : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-indigo-200" />
          <h3 className="font-bold text-white">Substitute Verification Portal</h3>
        </div>
        <span className="text-xs bg-indigo-500 text-indigo-100 px-2 py-1 rounded border border-indigo-400">
          Pharmacist Agent
        </span>
      </div>

      <div className="p-6">
        <p className="text-slate-600 mb-6 text-sm">
          Pharmacy out of stock? Friend offered a generic? Verify if an alternate medication is safe to replace your prescribed one.
        </p>

        {activeMedications.length === 0 ? (
          <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-medium">No active medications found.</p>
            <p className="text-xs text-slate-400">Please add a medication to the cabinet first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Input Column */}
            <div className="space-y-6">
               {/* 1. Select Prescribed */}
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">
                   1. Select Prescribed Medication (The "Truth")
                 </label>
                 <select 
                   value={selectedMedIndex}
                   onChange={(e) => {
                     setSelectedMedIndex(Number(e.target.value));
                     setResult(null);
                     setError(null);
                   }}
                   className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                   {activeMedications.map((med, idx) => (
                     <option key={idx} value={idx}>
                       {med.transcription.drug_name} ({med.transcription.dosage_strength})
                     </option>
                   ))}
                 </select>
                 {selectedMed && (
                   <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                      <strong>Active Ingredient:</strong> {selectedMed.transcription.drug_name} <br/>
                      <strong>Dosage:</strong> {selectedMed.transcription.dosage_strength}
                   </div>
                 )}
               </div>

               {/* 2. Input Alternate */}
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">
                   2. Input Alternate Candidate
                 </label>
                 <input 
                   type="text" 
                   value={altName}
                   onChange={(e) => {
                     setAltName(e.target.value);
                     if (error) setError(null);
                   }}
                   placeholder="e.g. Generic Ibuprofen, Advil..."
                   className="w-full p-3 mb-4 bg-white border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                 />
                 
                 {/* Increased height to accommodate FileUpload min-height of 16rem (256px) */}
                 <div className="h-64">
                    <FileUpload
                      label=""
                      subLabel="Or upload photo of alternate box/pill"
                      filePreview={altImage?.preview || null}
                      onFileSelect={handleFileSelect}
                      onClear={() => {
                        setAltImage(null);
                        setResult(null);
                        setError(null);
                      }}
                      icon={<Camera className="w-6 h-6 text-slate-300" />}
                    />
                 </div>
               </div>

               {/* Verify Button */}
               <button
                 onClick={handleVerify}
                 disabled={loading} // Changed: Enable button even if empty to show error
                 className={`
                   w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2
                   ${loading
                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                     : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:scale-[1.02]'}
                 `}
               >
                 {loading ? (
                   <>
                     <Search className="w-5 h-5 animate-spin" /> Verifying Safety...
                   </>
                 ) : (
                   <>
                     <CheckCircle className="w-5 h-5" /> Verify Safety Match
                   </>
                 )}
               </button>
               {error && (
                 <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-center font-medium animate-pulse">
                   {error}
                 </p>
               )}
            </div>

            {/* Result Column */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 min-h-[20rem] flex flex-col justify-center">
               {!result ? (
                 <div className="text-center text-slate-400">
                    <div className="bg-white p-4 rounded-full shadow-sm w-16 h-16 flex items-center justify-center mx-auto mb-3">
                       <Search className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="font-medium">Verification Result</p>
                    <p className="text-xs mt-1">AI analysis will appear here</p>
                 </div>
               ) : (
                 <div className="animate-fade-in space-y-6">
                    {/* Verdict Banner */}
                    <div className={`text-center p-6 rounded-xl border-2 ${
                      result.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' :
                      result.status === 'CAUTION' ? 'bg-amber-50 border-amber-200' :
                      'bg-rose-50 border-rose-200'
                    }`}>
                       <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                         result.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                         result.status === 'CAUTION' ? 'bg-amber-100 text-amber-600' :
                         'bg-rose-100 text-rose-600'
                       }`}>
                         {result.status === 'APPROVED' ? <CheckCircle className="w-6 h-6" /> :
                          result.status === 'CAUTION' ? <AlertTriangle className="w-6 h-6" /> :
                          <Ban className="w-6 h-6" />}
                       </div>
                       <h3 className={`text-xl font-bold mb-1 ${
                         result.status === 'APPROVED' ? 'text-emerald-800' :
                         result.status === 'CAUTION' ? 'text-amber-800' :
                         'text-rose-800'
                       }`}>
                         {result.status}
                       </h3>
                       <p className={`text-sm font-medium ${
                         result.status === 'APPROVED' ? 'text-emerald-700' :
                         result.status === 'CAUTION' ? 'text-amber-700' :
                         'text-rose-700'
                       }`}>
                         {result.reason}
                       </p>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dosage Adjustment</h4>
                          <p className="text-slate-700 font-medium">{result.dosage_adjustment}</p>
                       </div>
                       
                       {result.visual_check && (
                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Visual Check</h4>
                               {googleSearchUrl && (
                                 <a 
                                   href={googleSearchUrl}
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                                 >
                                   <Search className="w-3 h-3" /> Verify on Google
                                 </a>
                               )}
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">{result.visual_check}</p>
                         </div>
                       )}
                    </div>
                 </div>
               )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default SubstituteChecker;
