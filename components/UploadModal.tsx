
import React, { useState, useEffect } from 'react';

interface GistFile {
  filename: string;
  content: string;
  size: number;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerLocalUpload: () => void;
  onLoadGistContent: (content: string, filename: string) => void;
  octokit: any;
  gistId: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onTriggerLocalUpload,
  onLoadGistContent,
  octokit,
  gistId
}) => {
  const [view, setView] = useState<'selection' | 'gist-list'>('selection');
  const [files, setFiles] = useState<GistFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset view when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setView('selection');
      setError(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const fetchGistFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await octokit.request(`GET /gists/${gistId}`);
      if (response && response.files) {
        const fileList = Object.values(response.files) as GistFile[];
        // Sort files: user-prefixed files first, then by name
        const sorted = fileList.sort((a, b) => a.filename.localeCompare(b.filename));
        setFiles(sorted);
        setView('gist-list');
      } else {
        throw new Error("No files found in the specified Gist.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch files from GitHub.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredFiles = files.filter(f => 
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            Load Pattern
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-6">
          {view === 'selection' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                How would you like to load a pattern?
              </p>
              
              <button
                onClick={() => {
                  onTriggerLocalUpload();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Local File</h3>
                  <p className="text-xs text-slate-500">Import from your computer.</p>
                </div>
              </button>

              <button
                onClick={fetchGistFiles}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group text-left relative"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19l4.5-4.5L17.5 10"/><path d="M6.5 5l-4.5 4.5L6.5 14"/><path d="M13 6.5L11 17.5"/></svg>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">GitHub Gist</h3>
                  <p className="text-xs text-slate-500">Browse and load from the cloud.</p>
                </div>
                {error && <span className="absolute bottom-1 right-2 text-[10px] text-rose-500 italic">Error Loading</span>}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between gap-4">
                <button 
                  onClick={() => setView('selection')}
                  className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cloud patterns..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                     <svg className="h-3 w-3 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-10 text-slate-600 italic text-sm">
                    No matching files found.
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <button
                      key={file.filename}
                      onClick={() => {
                        onLoadGistContent(file.content, file.filename);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-lg text-left transition-all group"
                    >
                      <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 shrink-0">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-200 truncate">{file.filename}</div>
                        <div className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB • JS Module</div>
                      </div>
                      <svg className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
