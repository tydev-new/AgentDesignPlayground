
import React, { useEffect, useRef } from 'react';
import { ConsoleLog, ExecutionStatus } from '../types';

interface OutputPanelProps {
  logs: ConsoleLog[];
  status: ExecutionStatus;
  onClear: () => void;
  logLevel: 'DEBUG' | 'INFO';
  setLogLevel: (level: 'DEBUG' | 'INFO') => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ logs, status, onClear, logLevel, setLogLevel }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Filter logs based on level. 
  // INFO mode: Shows only strictly defined 'info' (Input/Output) and 'error' logs.
  // DEBUG mode: Shows everything including 'verbose' (console.log) and 'system' (console.debug).
  const filteredLogs = logs.filter(log => {
    if (logLevel === 'DEBUG') return true;
    // In INFO mode, strictly show Input/Output (info) and Errors.
    return log.type === 'info' || log.type === 'error';
  });

  return (
    <div className="w-full h-full flex flex-col bg-black border border-slate-800 rounded-lg overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 tracking-wider">Terminal Display</span>
          {status === ExecutionStatus.RUNNING && (
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as 'DEBUG' | 'INFO')}
              className="appearance-none bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] font-medium rounded px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer pr-6"
            >
              <option value="DEBUG">System Trace (Verbose)</option>
              <option value="INFO">Agent Results (Concise)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-400">
               <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
               </svg>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-slate-800"></div>

          <button 
            onClick={onClear}
            className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            title="Clear Output"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto code-font text-sm">
        {filteredLogs.length === 0 && logs.length === 0 && (
          <div className="text-slate-600 italic mt-4 text-center opacity-50">
            Ready to execute. Output will appear here.
          </div>
        )}

        {filteredLogs.length === 0 && logs.length > 0 && logLevel === 'INFO' && (
          <div className="text-slate-600 italic mt-4 text-center opacity-50">
            Execution active. Switch to "System Trace" to see detailed progress.
          </div>
        )}
        
        {filteredLogs.map((log) => (
          <div key={log.id} className="mb-2 break-words whitespace-pre-wrap">
            <span className="text-slate-600 text-xs mr-2 select-none">[{log.timestamp}]</span>
            <span className={`
              ${log.type === 'error' ? 'text-red-400 font-medium' : ''}
              ${log.type === 'warn' ? 'text-yellow-400' : ''}
              ${log.type === 'system' 
                ? (log.content.startsWith('[Router]') || log.content.startsWith('[Tool]') 
                    ? 'text-slate-400' 
                    : 'text-blue-400 italic') 
                : ''}
              ${log.type === 'verbose' ? 'text-slate-400' : ''}
              ${log.type === 'info' ? 'text-white font-semibold' : ''}
            `}>
              {log.content}
            </span>
          </div>
        ))}
        
        {status === ExecutionStatus.RUNNING && (
           <div className="animate-pulse text-slate-500 mt-2">
             Executing Agent Workflow...
           </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
