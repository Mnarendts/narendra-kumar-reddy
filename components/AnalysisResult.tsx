
import React, { useState } from 'react';
import { ScriptGuardResponse } from '../types';
import { 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Pill, 
  BookOpen, 
  AlertOctagon, 
  ScanText, 
  Stethoscope, 
  Check, 
  Info,
  Clock,
  Utensils,
  Ban,
  Palette,
  Circle,
  Type as TypeIcon,
  Divide,
  Stamp,
  FileText as FileTextIcon,
  ExternalLink,
  Search,
  CheckCircle2,
  User
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface AnalysisResultProps {
  data: ScriptGuardResponse[];
  onSave?: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, onSave }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  
  if (!data || data.length === 0) return null;

  const currentMed = data[activeIndex];
  const isSafe = currentMed.safety_status === 'SAFE';

  // Extract patient info from the first medication (assuming one patient per script)
  const patientDetails = data[0].patient_details;

  // DYNAMIC RECOVERY PROJECTION LOGIC
  const durationDays = currentMed.transcription.duration_days || 7;
  // Ensure we show at least 7 days, or the duration if longer. Cap visual at 30 to prevent crowding.
  const projectionDays = Math.min(Math.max(7, durationDays), 30);

  let chartData: any[] = [];
  const aiTimeline = currentMed.recovery_timeline || [];

  if (aiTimeline.length > 0) {
    // 1. Sort timeline by day
    const sortedTimeline = [...aiTimeline].sort((a, b) => a.day - b.day);
    
    // 2. Normalize to Chart Data
    chartData = sortedTimeline.map(event => ({
      name: `Day ${event.day}`,
      day: event.day,
      severity: event.severity_score,
      status: event.status,
      expectation: event.expectation
    }));

    // 3. Ensure a Day 0 (Start) point exists for a complete graph
    if (!chartData.find(d => d.day === 0)) {
        // Infer Day 0 based on Day 1's severity
        const firstDay = chartData[0];
        const startSeverity = firstDay ? Math.min(10, firstDay.severity + (firstDay.severity < 8 ? 2 : 1)) : 10;
        
        chartData.unshift({
            name: "Start",
            day: 0,
            severity: startSeverity,
            status: "Diagnosed",
            expectation: "Treatment initiated"
        });
    }

    // 4. Extrapolate if duration is longer than AI timeline
    const lastPoint = chartData[chartData.length - 1];
    if (lastPoint.day < projectionDays) {
       chartData.push({
         name: `Day ${projectionDays}`,
         day: projectionDays,
         severity: 0, 
         status: "Course Complete",
         expectation: "Treatment finished, full recovery expected"
       });
    }
  } else {
    // FALLBACK: Linear Projection
    for (let i = 0; i <= projectionDays; i++) {
       const startSev = 8;
       const severity = Math.max(0, startSev - (i * (startSev / projectionDays)));
       chartData.push({
         name: `Day ${i}`,
         day: i,
         severity: parseFloat(severity.toFixed(1)),
         status: severity === 0 ? "Recovered" : "Recovering",
         expectation: i === 0 ? "Start of treatment" : "Gradual improvement"
       });
    }
  }

  // Calculate dynamic Y-axis max based on data for better visualization of low-severity conditions
  const maxSeverityInData = Math.max(...chartData.map(d => d.severity), 0);
  const yAxisMax = maxSeverityInData <= 5 ? 5 : 10;

  const googleSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    `${currentMed.transcription.drug_name} ${currentMed.transcription.dosage_strength} pill`
  )}`;

  return (
    <div className="space-y-6">
      
      {/* Patient Context Card */}
      {patientDetails && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Patient Detected</p>
              <h2 className="text-xl font-bold text-slate-800">{patientDetails.name || "Unknown Patient"}</h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Age / DOB</p>
            <p className="text-lg font-semibold text-slate-700">{patientDetails.age_or_dob || "Not Specified"}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation for Multiple Medicines */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto no-scrollbar">
          {data.map((med, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all
                ${activeIndex === idx 
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}
              `}
            >
              <Pill className={`w-4 h-4 ${activeIndex === idx ? 'text-blue-200' : 'text-slate-400'}`} />
              {med.transcription.drug_name || `Medication ${idx + 1}`}
            </button>
          ))}
        </div>
        
        {/* Helper Badge */}
        <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
           {data.length} Medication{data.length > 1 ? 's' : ''} Identified
        </div>
      </div>

      {/* Safety Header */}
      <div className={`rounded-2xl p-6 border-l-8 shadow-sm flex items-start gap-4 ${
        isSafe ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-rose-500'
      }`}>
        <div className={`p-3 rounded-full ${isSafe ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {isSafe ? <ShieldCheck className="w-8 h-8" /> : <AlertOctagon className="w-8 h-8" />}
        </div>
        <div>
          <h2 className={`text-2xl font-bold ${isSafe ? 'text-emerald-800' : 'text-rose-800'}`}>
            {isSafe ? 'Prescription Verified Safe' : 'Safety Alert Issued'}
          </h2>
          <p className={`${isSafe ? 'text-emerald-700' : 'text-rose-700'} mt-1`}>
            {isSafe 
              ? `Confirmed match for ${currentMed.transcription.drug_name}. No immediate visual conflicts detected.` 
              : `Potential mismatch or safety concern detected for ${currentMed.transcription.drug_name}. Please review carefully.`}
          </p>
        </div>
      </div>

      {/* Script Breakdown & Dosage Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Script Digitizer */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-lg overflow-hidden border border-slate-700">
           <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanText className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-slate-100">Script Digitizer</h3>
            </div>
            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-800">AI OCR</span>
          </div>
          <div className="p-6 grid gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Raw Scanned Text (Snippet)</p>
              <div className="font-mono text-sm bg-black/30 p-4 rounded-lg border border-slate-700/50 text-slate-300 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                {currentMed.raw_script_extraction}
              </div>
            </div>
            <div>
               <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Standardized Format</p>
               <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                 <div className="flex justify-between mb-2">
                    <span className="text-slate-400 text-sm">Rx Drug:</span>
                    <span className="text-white font-medium">{currentMed.transcription.drug_name}</span>
                 </div>
                 {currentMed.transcription.generic_name && (
                   <div className="flex justify-between mb-2">
                      <span className="text-slate-400 text-sm">Generic Name:</span>
                      <span className="text-blue-300 font-medium italic">{currentMed.transcription.generic_name}</span>
                   </div>
                 )}
                 <div className="flex justify-between mb-2">
                    <span className="text-slate-400 text-sm">Strength:</span>
                    <span className="text-white font-medium">{currentMed.transcription.dosage_strength}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Sig (Instructions):</span>
                    <span className="text-white font-medium">{currentMed.transcription.frequency_translated}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Dosage Safety Engine */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-500" />
            <h3 className="font-semibold text-slate-800">Dosage Safety Engine</h3>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center">
            
            <div className="flex items-center justify-between mb-6">
              <div className="text-center w-full">
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold mb-2 ${
                  currentMed.dosage_analysis.status === 'OPTIMAL' ? 'bg-teal-100 text-teal-700' :
                  currentMed.dosage_analysis.status === 'REQUIRES_REVIEW' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {currentMed.dosage_analysis.status.replace('_', ' ')}
                </span>
                <div className="text-4xl font-bold text-slate-800">{currentMed.transcription.dosage_strength}</div>
                <div className="text-sm text-slate-500 mt-1">Prescribed Dosage</div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                   <p className="text-sm font-semibold text-slate-700">Clinical Recommendation</p>
                   <p className="text-sm text-slate-600 mt-1">{currentMed.dosage_analysis.recommendation}</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-200">
                <Check className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
                <div>
                   <p className="text-sm font-semibold text-slate-700">Standard Range</p>
                   <p className="text-sm text-slate-600 mt-1">{currentMed.dosage_analysis.standard_range}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Medication Guidance Action Plan */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800">Daily Action Plan (Pharmacist Guidance)</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
             <div className="p-3 bg-white rounded-full shadow-sm mb-3">
               <Clock className="w-6 h-6 text-blue-500" />
             </div>
             <h4 className="font-bold text-slate-700 mb-1">Best Time</h4>
             <p className="text-sm text-slate-600">{currentMed.medication_guidance.best_time_to_take}</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
             <div className="p-3 bg-white rounded-full shadow-sm mb-3">
               <Utensils className="w-6 h-6 text-orange-500" />
             </div>
             <h4 className="font-bold text-slate-700 mb-1">Food & Diet</h4>
             <p className="text-sm text-slate-600">{currentMed.medication_guidance.food_interaction}</p>
          </div>

          <div className="flex flex-col items-center text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
             <div className="p-3 bg-white rounded-full shadow-sm mb-3">
               <Ban className="w-6 h-6 text-purple-500" />
             </div>
             <h4 className="font-bold text-slate-700 mb-1">Missed Dose?</h4>
             <p className="text-sm text-slate-600">{currentMed.medication_guidance.missed_dose_logic}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forensic Transcription Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <FileTextIcon className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-800">Inferred Context</h3>
          </div>
          <div className="p-6 space-y-4">
             <div className="flex justify-between items-center">
              <span className="text-slate-500 text-sm">Medical Diagnosis</span>
              <span className="font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-sm">
                {currentMed.transcription.diagnosis_inferred}
              </span>
            </div>
             <div className="flex justify-between items-center pt-2 border-t border-slate-50">
              <span className="text-slate-500 text-sm">Frequency</span>
              <span className="font-medium text-slate-700">{currentMed.transcription.frequency_translated}</span>
            </div>
             <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <span className="block text-xs font-bold text-yellow-700 uppercase tracking-wide">Critical Warning</span>
                    <span className="text-sm text-yellow-800">{currentMed.patient_literacy_card.critical_warning}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* Visual Standard Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-slate-800">Visual Standard</h3>
            </div>
             {/* Dynamic Visual Link */}
             <a 
              href={googleSearchUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
            >
              <Search className="w-3 h-3 group-hover:scale-110 transition-transform" /> 
              <span>View on Google</span>
            </a>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            
            <div className="flex flex-col md:flex-row gap-6 mb-6">
               <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      currentMed.pill_verification.visual_match === 'MATCH' ? 'bg-emerald-100 text-emerald-700' :
                      currentMed.pill_verification.visual_match === 'MISMATCH' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {currentMed.pill_verification.visual_match.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {/* Explicit Appearance Description */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Appearance</p>
                    <p className="text-slate-700 leading-relaxed text-sm font-medium">
                      {currentMed.pill_verification.reasoning}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Info className="w-3 h-3 text-slate-400" />
                    <p className="text-[10px] text-slate-400">
                      Click the "View on Google" button above to compare with official images.
                    </p>
                  </div>
               </div>
            </div>

            {/* Visual Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-auto">
               <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center text-center border border-slate-100">
                  <Palette className="w-4 h-4 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 font-semibold mb-1">Color</span>
                  <span className="text-xs text-slate-700 font-medium truncate w-full" title={currentMed.pill_verification.details.color}>
                    {currentMed.pill_verification.details.color || 'N/A'}
                  </span>
               </div>
               <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center text-center border border-slate-100">
                  <Circle className="w-4 h-4 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 font-semibold mb-1">Shape</span>
                  <span className="text-xs text-slate-700 font-medium truncate w-full" title={currentMed.pill_verification.details.shape}>
                    {currentMed.pill_verification.details.shape || 'N/A'}
                  </span>
               </div>
               <div className="bg-blue-50 rounded-lg p-3 flex flex-col items-center text-center border border-blue-100">
                  <TypeIcon className="w-4 h-4 text-blue-500 mb-2" />
                  <span className="text-xs text-blue-600 font-semibold mb-1">Imprint</span>
                  <span className="text-sm font-bold text-slate-800 truncate w-full" title={currentMed.pill_verification.details.imprint}>
                    {currentMed.pill_verification.details.imprint || 'None'}
                  </span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Literacy Section */}
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-6 h-6 text-blue-200" />
          <h3 className="text-xl font-bold">Why am I taking this?</h3>
        </div>
        <p className="text-lg font-medium leading-relaxed opacity-95">
          "{currentMed.patient_literacy_card.purpose_simplified}"
        </p>
      </div>

      {/* Recovery Timeline Chart (Updated for Severity Scores) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold text-slate-800">Dynamic Recovery Projection</h3>
        </div>
        
        <p className="text-xs text-slate-500 mb-4 italic">
          *Graph based on AI-modeled pharmacological trajectory for {currentMed.transcription.drug_name}.
          <span className="block mt-1 font-semibold text-slate-400">10 = Severe Symptoms, 0 = Fully Recovered</span>
        </p>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="day"
                type="number"
                domain={[0, projectionDays]}
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(val) => `Day ${val}`}
                dy={10}
              />
              {/* Y Axis is Severity (0-10) with dynamic max if data is low-range */}
              <YAxis 
                domain={[0, yAxisMax]} 
                hide={false} 
                tickCount={6}
                width={30}
                tick={{ fill: '#64748b', fontSize: 12 }}
                label={{ value: 'Severity', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="severity" 
                stroke="#2ecc71" /* Matching Python script's Green */
                strokeWidth={3}
                dot={{ r: 6, fill: '#2ecc71', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Timeline Text (from AI if available) */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {chartData.slice(1, 4).map((event) => ( // Skip Start (Day 0) usually, show Days 1, 2, 3
               <div key={event.day} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                       {event.day}
                     </div>
                     <span className="font-semibold text-slate-700 text-sm uppercase truncate">{event.status || "Check-In"}</span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{event.expectation}</p>
                  <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${Math.max(0, 100 - (event.severity * 10))}%` }} 
                     />
                  </div>
                  <p className="text-[10px] text-right text-slate-400 mt-1">Recovery: {Math.round(Math.max(0, 100 - (event.severity * 10)))}%</p>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as any; // Access the full data object
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg max-w-xs">
        <p className="font-bold text-slate-800 mb-1">Day {label}</p>
        <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase">{data.status}</p>
        <p className="text-sm text-slate-600 mb-1">{data.expectation}</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
           <Activity className="w-3 h-3 text-slate-400" />
           <p className="text-xs font-bold text-slate-600">Severity Score: {data.severity}/10</p>
        </div>
      </div>
    );
  }
  return null;
};

export default AnalysisResult;
