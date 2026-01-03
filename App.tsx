
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { OutputPanel } from './components/OutputPanel';
import { UserInputPanel } from './components/UserInputPanel';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { ConfirmModal } from './components/ConfirmModal';
import { DownloadModal } from './components/DownloadModal';
import { UploadModal } from './components/UploadModal';
import { executeCode } from './services/geminiService';
import { createProxyClient } from './services/proxyService';
import { ConsoleLog, ExecutionStatus, StorageSettings, Span, UserInputRequest } from './types';
import { EXAMPLES } from './constants';

const LOCAL_STORAGE_EXAMPLE_KEY = 'agent_playground_example';
const SESSION_STORAGE_OVERRIDES_KEY = 'agent_playground_overrides_session';
const SESSION_STORAGE_API_KEY = 'agent_playground_api_key_session';
const LOCAL_STORAGE_STORAGE_KEY = 'agent_playground_storage';
const LOCAL_STORAGE_WIDTH_KEY = 'agent_playground_layout_width';

const PROXY_URL = "https://github-proxy-268629993676.us-central1.run.app/proxy";
const PROXY_KEY = "dbdm";
const TARGET_GIST_ID = "1e994191a96bb502c53967c24c426940";

const decodeCode = (str: string) => decodeURIComponent(atob(str));

const App: React.FC = () => {
  const octokit = useMemo(() => createProxyClient(PROXY_URL, PROXY_KEY), []);

  const [selectedExampleName, setSelectedExampleName] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_EXAMPLE_KEY) || EXAMPLES[0].name;
  });

  const [codeOverrides, setCodeOverrides] = useState<Record<string, string>>(() => {
    const saved = sessionStorage.getItem(SESSION_STORAGE_OVERRIDES_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [code, setCode] = useState<string>(() => {
    try {
      const hash = window.location.hash.substring(1);
      if (hash && hash.startsWith('code=')) {
        return decodeCode(hash.replace('code=', ''));
      }
    } catch (e) {
      console.error("Failed to decode shared link", e);
    }
    
    const initialExample = localStorage.getItem(LOCAL_STORAGE_EXAMPLE_KEY) || EXAMPLES[0].name;
    const savedOverrides = sessionStorage.getItem(SESSION_STORAGE_OVERRIDES_KEY);
    const overrides = savedOverrides ? JSON.parse(savedOverrides) : {};
    
    return overrides[initialExample] || EXAMPLES.find(ex => ex.name === initialExample)?.code || EXAMPLES[0].code;
  });

  const [storageSettings, setStorageSettings] = useState<StorageSettings>(() => {
    const savedLocal = localStorage.getItem(LOCAL_STORAGE_STORAGE_KEY);
    const savedSessionKey = sessionStorage.getItem(SESSION_STORAGE_API_KEY);
    
    const localSettings = savedLocal ? JSON.parse(savedLocal) : { isPublicGist: true, userName: '' };
    return { 
      ...localSettings, 
      geminiApiKey: savedSessionKey || '' 
    };
  });

  const logsRef = useRef<ConsoleLog[]>([]);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [status, setStatus] = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  const [logLevel, setLogLevel] = useState<'DEBUG' | 'INFO'>('DEBUG');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [currentGistId, setCurrentGistId] = useState<string | null>(null);
  
  const [apiError, setApiError] = useState<{ title: string; message: string } | null>(null);

  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_WIDTH_KEY);
    return saved ? parseFloat(saved) : 50;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [runtimeSpans, setRuntimeSpans] = useState<Span[] | null>(null);
  const [userInputRequest, setUserInputRequest] = useState<UserInputRequest | null>(null);
  const [isInputPanelOpen, setIsInputPanelOpen] = useState(false);
  
  const executionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem(SESSION_STORAGE_OVERRIDES_KEY, JSON.stringify(codeOverrides));
  }, [codeOverrides]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_EXAMPLE_KEY, selectedExampleName);
  }, [selectedExampleName]);

  useEffect(() => {
    if (storageSettings.geminiApiKey) {
      sessionStorage.setItem(SESSION_STORAGE_API_KEY, storageSettings.geminiApiKey);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_API_KEY);
    }

    const { geminiApiKey, ...rest } = storageSettings;
    localStorage.setItem(LOCAL_STORAGE_STORAGE_KEY, JSON.stringify(rest));
  }, [storageSettings]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_WIDTH_KEY, leftWidth.toString());
  }, [leftWidth]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      if (newLeftWidth > 20 && newLeftWidth < 80) {
        setLeftWidth(newLeftWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const addSystemLog = (type: 'system' | 'error' | 'info' | 'verbose' | 'warn', content: string) => {
    const newLog: ConsoleLog = {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date().toLocaleTimeString()
    };
    logsRef.current.push(newLog);
    setLogs([...logsRef.current]);
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setRuntimeSpans(null);
    setCodeOverrides(prev => ({
      ...prev,
      [selectedExampleName]: newCode
    }));
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash && hash.startsWith('code=')) {
        try {
          const newCode = decodeCode(hash.replace('code=', ''));
          handleCodeChange(newCode);
          addSystemLog('system', 'Shared code loaded via URL.');
        } catch (e) {}
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isModified = useMemo(() => {
    const original = EXAMPLES.find(ex => ex.name === selectedExampleName);
    return original ? original.code !== code : false;
  }, [code, selectedExampleName]);

  const runRegressionSuite = async () => {
    addSystemLog('system', '--- 🧪 STARTING REGRESSION TEST HARNESS ---');
    addSystemLog('system', 'Initializing Test Environment...');
    
    try {
      addSystemLog('system', 'CASE #1: Prompt Chaining Verification');
      
      const ch1Example = EXAMPLES.find(e => e.name.includes("Prompt Chaining"));
      if (!ch1Example) throw new Error("Could not find Ch 1 Example");

      addSystemLog('info', `Loading code for: ${ch1Example.name}`);
      const testCode = ch1Example.code;
      
      await executeCode(
        testCode,
        (newLog) => {
           logsRef.current.push(newLog);
           setLogs([...logsRef.current]);
        },
        (graph) => {},
        (req) => req.resolve("Regression Test"),
        storageSettings.geminiApiKey
      );

      const finalInfoLogs = logsRef.current.filter(l => l.type === 'info');
      const lastLog = finalInfoLogs[finalInfoLogs.length - 1]?.content || "";
      
      const hasCpu = lastLog.toLowerCase().includes('cpu');
      const hasMemory = lastLog.toLowerCase().includes('memory');
      const hasStorage = lastLog.toLowerCase().includes('storage');

      if (hasCpu && hasMemory && hasStorage) {
         addSystemLog('info', '✅ REGRESSION CASE #1 PASSED: Prompt Chaining output verified.');
      } else {
         addSystemLog('error', '❌ REGRESSION CASE #1 FAILED: Prompt Chaining output missing expected keys.');
         setStatus(ExecutionStatus.ERROR);
         return;
      }

      addSystemLog('system', '--- 🏁 ALL REGRESSION TESTS PASSED ---');
      setStatus(ExecutionStatus.SUCCESS);

    } catch (err: any) {
      addSystemLog('error', `🔥 REGRESSION FATAL ERROR: ${err.message}`);
      setStatus(ExecutionStatus.ERROR);
    }
  };

  const handleRun = useCallback(async () => {
    if (status === ExecutionStatus.RUNNING) return;

    if (!storageSettings.geminiApiKey || storageSettings.geminiApiKey.trim() === '') {
      setApiError({
        title: "Gemini API Key Required",
        message: "You must provide a Gemini API key to run agentic applications. Your key is only stored in memory for the current session."
      });
      return;
    }

    if (selectedExampleName === 'Empty Template' && code.trim() === 'regression') {
      logsRef.current = [];
      setLogs([]);
      setStatus(ExecutionStatus.RUNNING);
      runRegressionSuite();
      return;
    }

    const currentRunId = crypto.randomUUID();
    executionIdRef.current = currentRunId;
    setStatus(ExecutionStatus.RUNNING);
    
    logsRef.current = [];
    setLogs([]);
    
    setRuntimeSpans(null); 
    setUserInputRequest(null); 
    setIsInputPanelOpen(false); 

    addSystemLog('system', 'Initializing Execution Environment...');
    
    try {
      await executeCode(
        code, 
        (newLog) => {
          if (executionIdRef.current === currentRunId) {
            logsRef.current.push(newLog);
            setLogs([...logsRef.current]);
          }
        },
        (graphPayload) => {
          if (executionIdRef.current === currentRunId) {
            try {
              const spans = JSON.parse(graphPayload) as Span[];
              setRuntimeSpans(spans);
            } catch (e) {
              console.warn("Received invalid graph payload", e);
            }
          }
        },
        (req) => {
          if (executionIdRef.current === currentRunId) {
             setUserInputRequest(req);
             setIsInputPanelOpen(true); 
          }
        },
        storageSettings.geminiApiKey 
      );
      
      if (executionIdRef.current === currentRunId) {
        addSystemLog('system', 'Graph execution finished.');
        setStatus(ExecutionStatus.SUCCESS);
      }
    } catch (error: any) {
      if (executionIdRef.current === currentRunId) {
        const errorMessage = error.message || String(error);
        addSystemLog('error', `Runtime Error: ${errorMessage}`);
        setStatus(ExecutionStatus.ERROR);

        const lowerMsg = errorMessage.toLowerCase();
        const isAuthError = lowerMsg.includes('401') || lowerMsg.includes('403') || lowerMsg.includes('api_key_invalid') || lowerMsg.includes('unauthorized');
        const isQuotaError = lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('limit');

        if (isAuthError) {
          setApiError({
            title: "Invalid API Key",
            message: "The Gemini API key provided appears to be invalid or unauthorized. Please check your credentials in the sign-in modal."
          });
        } else if (isQuotaError) {
          setApiError({
            title: "API Quota Exceeded",
            message: "You have reached the rate limit or quota for your Gemini API key. Please wait a moment or try a different key."
          });
        }
      }
    } finally {
      if (executionIdRef.current === currentRunId) {
         executionIdRef.current = null;
         setUserInputRequest(null); 
      }
    }
  }, [code, status, storageSettings.geminiApiKey, selectedExampleName]);

  const handleStop = useCallback(() => {
    if (executionIdRef.current) {
      addSystemLog('system', 'Execution stopped by user.');
      executionIdRef.current = null;
      setStatus(ExecutionStatus.IDLE);
      setUserInputRequest(null);
    }
  }, []);

  const handleUserSubmit = (value: string | boolean) => {
    if (userInputRequest) {
      userInputRequest.resolve(value);
      setUserInputRequest(null);
    }
  };

  const handleUserCancel = () => {
    if (userInputRequest) {
      userInputRequest.resolve(null);
      setUserInputRequest(null);
    }
  };

  const getEffectiveFilename = () => {
    const firstLine = code.split('\n')[0];
    const match = firstLine.match(/^\/\/\s*Filename:\s*(.+)$/i);
    if (match && match[1]) {
      let name = match[1].trim();
      if (!name.match(/\.(js|ts|mjs)$/i)) {
        name += '.js';
      }
      return name;
    }
    return selectedExampleName.toLowerCase().replace(/\s+/g, '_') + '.js';
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = getEffectiveFilename();
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addSystemLog('system', `File downloaded as: ${filename}`);
  };

  const handleSaveToGist = async (customFileName?: string) => {
    if (isSavingToCloud) return;
    
    setIsSavingToCloud(true);
    addSystemLog('system', `Updating GitHub Gist (${TARGET_GIST_ID}) via proxy...`);
    
    try {
      const baseFilename = customFileName || getEffectiveFilename();
      const userId = (storageSettings.userName || 'anon').trim().toLowerCase().replace(/\s+/g, '-');
      const gistFileName = `${userId}_${baseFilename}`;

      const description = storageSettings.userName 
        ? `Agent Design Playground - ${selectedExampleName} (by ${storageSettings.userName})`
        : `Agent Design Playground - ${selectedExampleName}`;

      const params = {
        description,
        files: {
          [gistFileName]: {
            content: code
          }
        }
      };

      const result = await octokit.request(`PATCH /gists/${TARGET_GIST_ID}`, params);

      const gistUrl = result.html_url;
      const gistId = result.id;
      
      setCurrentGistId(gistId);
      setIsDownloadModalOpen(false); 
      
      try {
        await navigator.clipboard.writeText(gistUrl);
        addSystemLog('info', `Cloud Update Success! File "${gistFileName}" updated. URL copied to clipboard: ${gistUrl}`);
      } catch (clipError) {
        addSystemLog('info', `Cloud Update Success! File "${gistFileName}" updated. URL: ${gistUrl}`);
      }
      
    } catch (error: any) {
      addSystemLog('error', error.message || "Failed to update cloud gist.");
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleCodeChange(content);
        addSystemLog('system', `Code imported from locally uploaded file: ${file.name}`);
        e.target.value = '';
      };
      reader.onerror = () => {
        addSystemLog('error', `Failed to read file: ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadGistContent = (content: string, filename: string) => {
    handleCodeChange(content);
    addSystemLog('system', `Code imported from cloud gist file: ${filename}`);
  };

  const loadExample = (exampleName: string) => {
    const example = EXAMPLES.find(ex => ex.name === exampleName);
    if (example) {
      window.location.hash = '';
      setSelectedExampleName(example.name);
      const targetCode = codeOverrides[example.name] || example.code;
      setCode(targetCode);
      
      logsRef.current = [];
      setLogs([]);
      
      setStatus(ExecutionStatus.IDLE);
      setCurrentGistId(null); 
      setRuntimeSpans(null);
    }
  };

  const handleRevert = () => {
    setIsRevertModalOpen(true);
  };

  const confirmRevertAction = () => {
    const original = EXAMPLES.find(ex => ex.name === selectedExampleName);
    if (original) {
      window.location.hash = '';
      setCode(original.code);
      
      setCodeOverrides(prev => {
        const next = { ...prev };
        delete next[selectedExampleName];
        return next;
      });

      logsRef.current = [];
      setLogs([]);
      setStatus(ExecutionStatus.IDLE);
      setCurrentGistId(null);
      setRuntimeSpans(null);
      addSystemLog('system', `Pattern "${selectedExampleName}" reverted to original template.`);
    }
    setIsRevertModalOpen(false);
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-blue-500/30 ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
        
        <div className="flex items-center gap-3">
          <button onClick={() => setIsInfoModalOpen(true)} className="focus:outline-none hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.22.53l-2.25 2.25a.75.75 11-1.06-1.06L15.44 12l-1.72-1.72a.75.75 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm-10.28 0a.75.75 0 01.22-.53l2.25-2.25a.75.75 111.06 1.06L8.56 12l1.72 1.72a.75.75 11-1.06 1.06l-2.25-2.25a.75.75 0 01-.22-.53z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
          
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg tracking-tight text-white leading-none cursor-pointer" onClick={() => setIsInfoModalOpen(true)}>
              Agent Design Playground
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-4">
             <span className="text-xs text-white font-semibold tracking-wider">Pattern:</span>
             <div className="relative group">
                <select 
                  value={selectedExampleName}
                  onChange={(e) => loadExample(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 cursor-pointer transition-colors w-64 truncate"
                >
                  {EXAMPLES.map((ex) => (
                    <option key={ex.name} value={ex.name}>{ex.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              title="Save or share pattern"
              className="flex items-center justify-center p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>

            {selectedExampleName === 'Empty Template' && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                title="Load pattern"
                className="flex items-center justify-center p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              </button>
            )}
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".js,.ts,.txt,.mjs"
              className="hidden"
            />

            <div className="w-[1px] h-6 bg-slate-800 mx-1"></div>

            <button
              onClick={handleRun}
              disabled={status === ExecutionStatus.RUNNING}
              className={`
                flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg
                ${status === ExecutionStatus.RUNNING 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 hover:shadow-indigo-500/40 active:transform active:scale-95'}
              `}
            >
              {status === ExecutionStatus.RUNNING ? (
                 <>
                   <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   Running...
                 </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                  Run
                </>
              )}
            </button>

            {status === ExecutionStatus.RUNNING && (
              <button
                onClick={handleStop}
                className="flex items-center justify-center p-2 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 hover:bg-red-900/50 hover:text-red-200 transition-colors shadow-lg"
                title="Stop Execution"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v12a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              title="User Account & API"
              className={`flex items-center justify-center p-2 rounded-lg border transition-all active:scale-95 ${storageSettings.geminiApiKey ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-indigo-900/20 border-indigo-500/30 text-indigo-400 animate-pulse'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main ref={containerRef} className="flex-1 flex overflow-hidden p-4 relative">
        <div 
          className="min-w-0 flex flex-col" 
          style={{ width: `${leftWidth}%` }}
        >
          <CodeEditor 
            key={selectedExampleName} 
            code={code} 
            onChange={(c) => handleCodeChange(c)} 
            disabled={status === ExecutionStatus.RUNNING}
            runtimeSpans={runtimeSpans}
            isModified={isModified}
            onRevert={handleRevert}
          />
        </div>

        <div 
          onMouseDown={startResizing}
          className={`group relative w-4 flex-shrink-0 cursor-col-resize flex justify-center z-10 ${isResizing ? 'bg-indigo-500/20' : ''}`}
        >
          <div className={`w-[1px] h-full transition-colors ${isResizing ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-800 group-hover:bg-slate-600'}`}></div>
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-1 rounded-full bg-slate-500"></div>
            <div className="w-1 h-1 rounded-full bg-slate-500"></div>
            <div className="w-1 h-1 rounded-full bg-slate-500"></div>
          </div>
        </div>

        <div 
          className="min-w-0 flex flex-col relative rounded-lg overflow-hidden border border-slate-800 bg-black"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <div className="flex-1 min-h-0 flex flex-col">
            <OutputPanel 
              logs={logs} 
              status={status}
              onClear={() => {
                logsRef.current = [];
                setLogs([]);
              }}
              logLevel={logLevel}
              setLogLevel={setLogLevel}
            />
          </div>
          
          <UserInputPanel 
            request={userInputRequest}
            isOpen={isInputPanelOpen}
            onToggle={() => setIsInputPanelOpen(!isInputPanelOpen)}
            onSubmit={handleUserSubmit}
            onCancel={handleUserCancel}
          />
        </div>
      </main>
      
      <footer className="h-6 bg-slate-900 border-t border-slate-800 flex items-center px-4 justify-between text-[10px] text-slate-500 select-none shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status === ExecutionStatus.RUNNING ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
            {`System: ${status === ExecutionStatus.RUNNING ? 'Executing' : 'Ready'}`}
          </span>
          <span>Env: Browser Runtime</span>
        </div>
        <div>
          Agent Playground • Gemini 2.5 Flash
        </div>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={storageSettings}
        onSave={setStorageSettings}
      />
      
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <ConfirmModal
        isOpen={isRevertModalOpen}
        onClose={() => setIsRevertModalOpen(false)}
        onConfirm={confirmRevertAction}
        title="Reset Pattern Code?"
        message={`Your current changes for "${selectedExampleName}" will be permanently lost and replaced with the original template.`}
        confirmText="Yes, Revert to Original"
        type="warning"
      />

      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onSaveLocally={handleDownload}
        onSaveToGist={handleSaveToGist}
        isSavingToGist={isSavingToCloud}
        settings={storageSettings}
        onUpdateSettings={setStorageSettings}
        defaultFileName={getEffectiveFilename()}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onTriggerLocalUpload={handleUploadClick}
        onLoadGistContent={handleLoadGistContent}
        octokit={octokit}
        gistId={TARGET_GIST_ID}
      />

      <ConfirmModal
        isOpen={!!apiError}
        onClose={() => {
          setApiError(null);
          setIsSettingsOpen(true);
        }}
        onConfirm={() => {
          setApiError(null);
          setIsSettingsOpen(true);
        }}
        title={apiError?.title || "Error"}
        message={apiError?.message || ""}
        confirmText="Go to Sign-In"
        type="info"
      />
    </div>
  );
};

export default App;
