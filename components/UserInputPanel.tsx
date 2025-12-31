
import React, { useState, useEffect, useRef } from 'react';
import { UserInputRequest } from '../types';

interface UserInputPanelProps {
  request: UserInputRequest | null;
  isOpen: boolean;
  onToggle: () => void;
  onSubmit: (value: string | boolean) => void;
  onCancel: () => void;
}

export const UserInputPanel: React.FC<UserInputPanelProps> = ({ 
  request, 
  isOpen, 
  onToggle, 
  onSubmit, 
  onCancel 
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and set default value when a new request arrives
  useEffect(() => {
    if (request && isOpen) {
      setValue(request.defaultValue || '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [request, isOpen]);

  const handleSubmit = () => {
    if (!request) return;
    
    if (request.type === 'confirm') {
      onSubmit(true); // 'Enter' on a confirm dialog means Yes
    } else {
      onSubmit(value);
    }
    setValue('');
  };

  const handleCancel = () => {
    if (!request) return;

    if (request.type === 'confirm') {
      onSubmit(false); // 'Cancel' on a confirm dialog means No
    } else {
      onCancel(); // For text, it usually returns null
    }
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // If minimized, show a slim bar
  if (!isOpen) {
    return (
      <div 
        className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={onToggle}
      >
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          {request ? (
            <span className="text-indigo-400 animate-pulse">● Waiting for Input</span>
          ) : (
            "User Input"
          )}
        </span>
        <button className="text-slate-500 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
      </div>
    );
  }

  // Expanded State
  return (
    <div className="bg-slate-900 border-t border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div 
        className="h-8 flex items-center justify-between px-4 bg-slate-800/50 cursor-pointer border-b border-slate-800"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">User Input</span>
            {request && <span className="text-[10px] text-indigo-400 font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">Active Request</span>}
        </div>
        <button className="text-slate-500 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {request && (
           <div className="text-xs text-slate-300 font-medium whitespace-pre-wrap font-mono border-l-2 border-indigo-500 pl-3 py-1">
             {request.message}
           </div>
        )}

        {(!request || request.type === 'text') && (
            <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!request}
                placeholder={request ? "Type your response here..." : "No active input request."}
                className="w-full h-[4.5em] bg-black border border-slate-700 rounded-md p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-none font-mono"
            />
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button 
            onClick={handleCancel}
            disabled={!request}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            {request?.type === 'confirm' ? 'Reject (Cancel)' : 'Cancel'}
          </button>
          
          <button 
            onClick={handleSubmit}
            disabled={!request}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {request?.type === 'confirm' ? 'Approve (Enter)' : 'Submit (Enter)'}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
