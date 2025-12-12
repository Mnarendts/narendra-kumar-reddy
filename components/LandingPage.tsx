
import React, { useState, useEffect } from 'react';
import { ShieldPlus, ArrowRight, UserCheck, Globe, Siren, User, Mail, Phone, Lock, AlertCircle } from 'lucide-react';
import { COUNTRY_CONFIG, LANGUAGES } from '../constants';
import { UserInfo } from '../types';

interface LandingPageProps {
  onLogin: (details: UserInfo) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  // Default to USA for initial state
  const [country, setCountry] = useState("🇺🇸 USA");
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("English");
  
  // Error State
  const [error, setError] = useState<string | null>(null);
  
  // Derive config based on selected country
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG["🇺🇸 USA"];

  // Sort countries and languages for cleaner UI
  const sortedCountries = Object.keys(COUNTRY_CONFIG).sort();
  const sortedLanguages = [...LANGUAGES].sort();

  // Effect to update language when country changes, ensuring it matches available options
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    setCountry(newCountry);
    
    const configLang = COUNTRY_CONFIG[newCountry]?.lang;
    if (configLang) {
        // Attempt to find the full language string in the LANGUAGES array
        // We look for the English name inside parenthesis or strict equality
        const matchedLanguage = LANGUAGES.find(l => 
            l === configLang || 
            l.includes(`(${configLang})`) || 
            l.endsWith(configLang) // Fallback for simple includes might be risky (e.g. "Java" in "Javascript" - unlikely here but good practice)
        );
        
        if (matchedLanguage) {
            setLanguage(matchedLanguage);
        } else {
            // If strictly not found, keep current or default to English, or set blindly
            setLanguage(configLang); 
        }
    }
  };

  const handleEnter = () => {
      if(!name.trim() || !phone.trim()) {
          setError("Please enter your Patient Name and Phone Number to continue.");
          return;
      }
      
      const fullPhone = `${config.code} ${phone}`;
      
      onLogin({
          name,
          email,
          country,
          phone: fullPhone,
          language, // This now contains the full string e.g. "हिन्दी (Hindi)"
          sos: config.sos
      });
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto w-full px-6 py-8 flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <ShieldPlus className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">ScriptGuard Portal</span>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <Lock className="w-3 h-3" />
            <span>Secure Patient Access</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="flex-1 flex flex-col justify-center items-center text-center px-6 pt-8 pb-32 relative overflow-hidden">
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-blue-50/80 to-transparent rounded-full blur-3xl -z-10"></div>

        <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-4 max-w-4xl">
           ScriptGuard Health Portal
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mb-10 font-medium">
           Secure Login for Patients. Sync your health data for AI safety verification.
        </p>

        {/* Login Card */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-left relative z-20">
            <div className="absolute -top-4 -left-4 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Patient Login
            </div>
            
            <div className="space-y-5">
                
                {/* 1. Country Selection (Drivers) */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Select Nationality / Country
                    </label>
                    <select 
                        value={country}
                        onChange={handleCountryChange}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                        {sortedCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* 2. User Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <User className="w-3 h-3" /> Patient Name
                        </label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (error) setError(null);
                            }}
                            placeholder="John Doe"
                            className={`w-full bg-slate-50 border text-slate-900 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error && !name.trim() ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Mail className="w-3 h-3" /> Patient Email
                        </label>
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* 3. Phone Number with Auto-Code */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Phone className="w-3 h-3" /> Phone Number
                    </label>
                    <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-sm font-bold">
                            {config.code}
                        </span>
                        <input 
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              if (error) setError(null);
                            }}
                            placeholder="9876543210"
                            className={`w-full bg-slate-50 border text-slate-900 rounded-r-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error && !phone.trim() ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
                        />
                    </div>
                </div>

                {/* 4. Language Preference */}
                <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Preferred AI Language
                    </label>
                    <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {sortedLanguages.map(lang => (
                             <option key={lang} value={lang}>
                                {lang} {lang.includes(config.lang) ? "(Recommended)" : ""}
                             </option>
                        ))}
                    </select>
                </div>

                <div className="pt-2">
                    {/* Validation Error Message */}
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm font-semibold animate-pulse">
                         <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs bg-red-50 p-2 rounded-lg border border-red-100 mb-4">
                        <span className="text-red-600 font-semibold flex items-center gap-1"><Siren className="w-3 h-3" /> Emergency SOS:</span>
                        <span className="font-bold text-red-700">{config.sos}</span>
                    </div>

                    <button
                        onClick={handleEnter}
                        className="w-full group bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                    >
                        Login & Sync Health Data <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

            </div>
        </div>
      </header>
    </div>
  );
};

export default LandingPage;
