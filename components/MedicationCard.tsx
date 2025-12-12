
import React from 'react';
import { Pill, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { ScriptGuardResponse } from '../types';

interface MedicationCardProps {
  data: ScriptGuardResponse;
}

const MedicationCard: React.FC<MedicationCardProps> = ({ data }) => {
  const isSafe = data.safety_status === 'SAFE';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col h-full">
      <div className={`h-2 w-full ${isSafe ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div className="bg-slate-100 p-2 rounded-lg">
            <Pill className="w-6 h-6 text-indigo-600" />
          </div>
          <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            isSafe ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {data.safety_status}
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-slate-800 mb-1 leading-tight">
          {data.transcription.drug_name}
        </h3>
        {data.transcription.generic_name && (
          <p className="text-xs text-blue-600 font-medium mb-1 italic">
            ({data.transcription.generic_name})
          </p>
        )}
        <p className="text-sm font-medium text-slate-500 mb-4">
          {data.transcription.dosage_strength}
        </p>

        <div className="space-y-3 mt-auto">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-600 leading-snug">
              <span className="font-semibold text-slate-700">Schedule:</span> {data.transcription.frequency_translated}
            </p>
          </div>
          
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
             <div className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-600 leading-snug">
                  <span className="font-semibold text-slate-700">Why:</span> {data.transcription.diagnosis_inferred}
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationCard;
