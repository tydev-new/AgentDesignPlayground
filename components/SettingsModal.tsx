
import React, { useState } from 'react';
import { StorageSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StorageSettings;
  onSave: (settings: StorageSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            User Account & API
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Gemini API Key Section */}
          <section className="space-y-4">
            <div className="space-y-3">
              <label className="text-xs font-bold text-indigo-400 tracking-wider uppercase">Gemini API Key Required</label>
              <p className="text-sm text-slate-300 leading-relaxed">
                To run these agent samples, you need a Gemini API key. If you don't have one, you can generate it for free at Google AI Studio.
              </p>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 rounded-md transition-all active:scale-95 group"
              >
                Get Free API Key 
                <span className="ml-1.5 group-hover:translate-x-0.5 transition-transform">→</span>
              </a>
            </div>

            <div className="space-y-3">
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Paste key here (starts with AIza...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-700 font-mono shadow-inner"
              />

              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5" role="img" aria-label="Privacy">🔒</span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  <span className="font-bold">Privacy Note:</span> Your key is stored in your browser's Session Storage. It persists through page reloads but is automatically wiped when you close this tab. It is used exclusively to communicate directly with Google's API and is never sent to our servers.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSave({ ...settings, geminiApiKey: geminiKey });
              onClose();
            }}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
