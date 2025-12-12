import React, { useState } from 'react';
import { Camera, AlertTriangle, CheckCircle, Search, Trash2 } from 'lucide-react';
import FileUpload from './FileUpload';
import { scanMedicineShelf } from '../services/geminiService';
import { ScriptGuardResponse, CabinetScanResult } from '../types';

interface CabinetScannerProps {
  activeMedications: ScriptGuardResponse[];
  language: string;
}

const CabinetScanner: React.FC<CabinetScannerProps> = ({ activeMedications, language }) => {
  const [shelfImage, setShelfImage] = useState<{ file: File; preview: string } | null>(null);
  const [result, setResult] = useState<CabinetScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setShelfImage({ file, preview: URL.createObjectURL(file) });
    setResult(null);
    setError(null);
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

  const handleScan = async () => {
    if (!shelfImage?.file) return;
    if (activeMedications.length === 0) {
      setError("Please add at least one active medication to your cabinet first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base64 = await fileToBase64(shelfImage.file);
      const scanResult = await scanMedicineShelf(base64, activeMedications, language);
      setResult(scanResult);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze the image. Please try a clearer photo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-teal-400" />
          <h3 className="font-bold text-white">Cabinet Clean-Up (Safety Check)</h3>
        </div>
        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-600">
          AI Vision
        </span>
      </div>

      <div className="p-6">
        <p className="text-slate-600 mb-6 text-sm">
          Take a photo of your medicine shelf. We will cross-reference every bottle against your active prescriptions to find conflicts, duplicates, or dangerous interactions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left: Input */}
          <div className="flex flex-col gap-4">
            <div className="h-64">
              <FileUpload
                label="Upload Shelf Photo"
                subLabel="Ensure labels are visible"
                filePreview={shelfImage?.preview || null}
                onFileSelect={handleFileSelect}
                onClear={() => {
                  setShelfImage(null);
                  setResult(null);
                }}
                icon={<Camera className="w-8 h-8 text-slate-300 mb-2" />}
              />
            </div>
            
            <button
              onClick={handleScan}
              disabled={!shelfImage || loading || activeMedications.length === 0}
              className={`
                w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2
                ${!shelfImage || loading || activeMedications.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg'}
              `}
            >
              {loading ? (
                <>
                  <Search className="w-5 h-5 animate-spin" /> Scanning Bottles...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" /> Scan Shelf for Dangers
                </>
              )}
            </button>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100 text-center">
                {error}
              </p>
            )}
          </div>

          {/* Right: Results */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 min-h-[16rem]">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Search className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Scan results will appear here</p>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                
                {/* Header Stats */}
                <div className="flex items-center justify-between text-sm text-slate-600 border-b border-slate-200 pb-2">
                  <span>Items Found: <strong>{result.shelf_inventory.length}</strong></span>
                  <span className={result.conflicts.length > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                    {result.conflicts.length} Issues Detected
                  </span>
                </div>

                {/* Conflicts Section */}
                {result.conflicts.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Dangers Found
                    </h4>
                    {result.conflicts.map((conflict, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border-l-4 border-l-red-500 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-slate-800">{conflict.shelf_drug}</span>
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase">
                            {conflict.action}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-snug">{conflict.conflict_reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-emerald-800 font-medium">No conflicts found!</p>
                    <p className="text-xs text-emerald-600">Your shelf appears safe regarding your active meds.</p>
                  </div>
                )}

                {/* Safe Items Section */}
                {result.safe_items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Safe / Unrelated Items</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.safe_items.map((item, idx) => (
                        <span key={idx} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-full">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CabinetScanner;