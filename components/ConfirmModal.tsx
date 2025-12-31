
import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  // Made optional to satisfy TypeScript inference when other props might be unstable
  confirmText?: string;
  type?: 'warning' | 'danger' | 'info';
}

// Added default value for confirmText to handle cases where it might be omitted or inferred incorrectly
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const typeColors = {
    warning: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
    danger: 'text-rose-500 border-rose-500/20 bg-rose-500/10',
    info: 'text-indigo-500 border-indigo-500/20 bg-indigo-500/10'
  };

  const btnColors = {
    warning: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20',
    danger: 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20',
    info: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className={`text-lg font-bold flex items-center gap-2 ${type === 'danger' ? 'text-rose-500' : 'text-white'}`}>
            <div className={`p-1 rounded ${type === 'danger' ? 'text-rose-500' : 'text-indigo-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/>
                <path d="M12 17h.01"/>
              </svg>
            </div>
            {title}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`px-6 py-2 text-white rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 ${btnColors[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
