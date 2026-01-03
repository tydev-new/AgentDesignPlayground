
import React, { useState, useEffect } from 'react';
import { StorageSettings } from '../types';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLocally: () => void;
  onSaveToGist: (fileName?: string) => void;
  isSavingToGist: boolean;
  settings: StorageSettings;
  onUpdateSettings: (settings: StorageSettings) => void;
  defaultFileName: string;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ 
  isOpen, 
  onClose, 
  onSaveLocally, 
  onSaveToGist,
  isSavingToGist,
  settings,
  onUpdateSettings,
  defaultFileName
}) => {
  const [localUserName, setLocalUserName] = useState(settings.userName || '');
  const [localFileName, setLocalFileName] = useState(defaultFileName);
  const [isGistExpanded, setIsGistExpanded] = useState(!settings.userName);

  // Synchronize local state with props ONLY when the modal is opened.
  // We exclude settings.userName from dependencies to prevent the expansion
  // state from being reset every time the user types and triggers onUpdateSettings.
  useEffect(() => {
    if (isOpen) {
      const currentUserName = settings.userName || '';
      setLocalUserName(currentUserName);
      setLocalFileName(defaultFileName);
      // Auto-expand if no user name is set
      setIsGistExpanded(!currentUserName);
    }
  }, [isOpen]); 

  if (!isOpen) return null;

  const handleUserNameChange = (val: string) => {
    setLocalUserName(val);
    // Directly update the global stored user name so it's reflected in other modals
    onUpdateSettings({ ...settings, userName: val });
  };

  const isGistActionDisabled = isSavingToGist || !localUserName.trim() || !localFileName.trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            Save Pattern
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-400">
            Choose how you would like to save your current work.
          </p>
          
          <div className="grid gap-3">
            {/* Local Download Option */}
            <button
              onClick={() => {
                onSaveLocally();
                onClose();
              }}
              className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white">Save Locally</h3>
                <p className="text-xs text-slate-500 truncate">Download as a JavaScript file.</p>
              </div>
            </button>

            {/* GitHub Gist Option (Container) */}
            <div className={`flex flex-col border rounded-xl transition-all overflow-hidden ${isGistExpanded ? 'bg-slate-800/80 border-slate-600 shadow-lg' : 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/30'}`}>
              <button
                onClick={() => setIsGistExpanded(!isGistExpanded)}
                className="flex items-center gap-4 p-4 transition-all group text-left w-full focus:outline-none"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform shrink-0 ${isGistExpanded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-400 group-hover:scale-110'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19l4.5-4.5L17.5 10"/><path d="M6.5 5l-4.5 4.5L6.5 14"/><path d="M13 6.5L11 17.5"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">GitHub Gist</h3>
                  <p className="text-xs text-slate-500 truncate">Share and host in the cloud.</p>
                </div>
                <div className={`transition-transform duration-300 ${isGistExpanded ? 'rotate-180 text-emerald-400' : 'text-slate-500'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              {isGistExpanded && (
                <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider">User Name (Required)</label>
                      <input 
                        type="text" 
                        value={localUserName}
                        onChange={(e) => handleUserNameChange(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder:text-slate-800 shadow-inner"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider">File Name</label>
                      <input 
                        type="text" 
                        value={localFileName}
                        onChange={(e) => setLocalFileName(e.target.value)}
                        placeholder="pattern.js"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder:text-slate-800 shadow-inner"
                      />
                    </div>

                    <button
                      onClick={() => {
                        onSaveToGist(localFileName);
                        setIsGistExpanded(false);
                      }}
                      disabled={isGistActionDisabled}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                        isGistActionDisabled 
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 active:scale-[0.98]'
                      }`}
                    >
                      {isSavingToGist ? (
                        <>
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                          Uploading...
                        </>
                      ) : (
                        'Upload to GitHub Gist'
                      )}
                    </button>
                    
                    {!localUserName.trim() && (
                      <p className="text-[10px] text-amber-500/80 italic flex items-center gap-1 justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        User Name is required for Gists.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
