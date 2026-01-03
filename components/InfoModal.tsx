
import React, { useState, useRef } from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [isContactExpanded, setIsContactExpanded] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;

    setStatus('sending');
    
    // We use a small timeout to allow the "Sending..." state to render
    // before the form submission potentially blocks or redirects the hidden iframe.
    setTimeout(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://formsubmit.co/agentdesignplayground@gmail.com';
      form.target = 'contact_form_target';

      // Required fields for FormSubmit.co
      const fields = {
        'email': email,
        'message': message,
        '_subject': 'New Message from Agent Design Playground',
        '_captcha': 'false', 
        '_template': 'table'
      };

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      // Since we can't easily detect the success page inside a cross-origin iframe,
      // we assume success after a short delay.
      setTimeout(() => {
        setStatus('success');
        setEmail('');
        setMessage('');
        
        // Reset status to idle after a period
        setTimeout(() => {
          setStatus('idle');
          setIsContactExpanded(false); // Auto-collapse on success
        }, 5000);
      }, 2000);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Agent Design Playground
                </h2>
                <p className="text-sm font-medium">
                  <a href="https://www.linkedin.com/in/ytian/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4 transition-colors">By Yong Tian</a>
                </p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
            <div className="text-sm text-slate-300 leading-relaxed mb-2 space-y-3">
                <p>
                  Experience <a href="https://www.linkedin.com/posts/searchguy_agenticai-designpatterns-ai-activity-7351622833136906241-GPiR/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4 transition-colors"><strong>Agentic Design Patterns</strong> by <strong>Antonio Gulli</strong></a> as a live, interactive lab.
                </p>
                <p>
                  Explore core patterns like Reflection, MCP, and RAG using plain, dependency-free JavaScript.
                </p>
                <p>
                  Experiment with raw logic directly in your browser—no installs required. Modify the code and instantly see the impact. <a href="https://medium.com/@tydev2025/agent-design-playground-from-static-blueprints-to-live-code-2fc2fde704d3" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4 transition-colors font-medium">More details here</a>.
                </p>
            </div>

            {/* Direct Link: Buy the Book */}
            <div className="space-y-2">
                <a 
                    href="https://www.amazon.com/Agentic-Design-Patterns-Hands-Intelligent/dp/3032014018" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800 rounded-md border border-slate-800 hover:border-slate-600 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-amber-500 group-hover:text-amber-400">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white">Buy the Book</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wide">Amazon</span>
                    </div>
                </a>
            </div>

            {/* Direct Link: Playground Source Code */}
            <div className="space-y-2">
                <a 
                    href="https://github.com/tydev-new/AgentDesignPlayground" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800 rounded-md border border-slate-800 hover:border-slate-600 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-emerald-500 group-hover:text-emerald-400">
                             <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 1.19 6.44 1.54A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white">Playground Source Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wide">GitHub</span>
                    </div>
                </a>
            </div>

            {/* Contact Section */}
            <div className="space-y-2">
                <button 
                    onClick={() => setIsContactExpanded(!isContactExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/30 hover:bg-slate-800 rounded-md border border-slate-800 hover:border-slate-600 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="text-indigo-500 group-hover:text-indigo-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white">Contact Us</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className={`text-slate-500 group-hover:text-slate-300 transform transition-transform duration-300 ${isContactExpanded ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </button>
                
                {isContactExpanded && (
                    <div className="p-4 bg-slate-800/20 border border-slate-800 rounded-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1">
                            <input 
                                type="email" 
                                required
                                placeholder="Your email address" 
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>

                        <div className="space-y-1">
                            <textarea 
                                required
                                placeholder="Your message..." 
                                rows={3}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                            />
                        </div>

                        <button 
                            onClick={handleSubmit}
                            disabled={status === 'sending' || !email || !message}
                            className={`w-full py-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                status === 'success' ? 'bg-emerald-600 text-white' : 
                                status === 'error' ? 'bg-rose-600 text-white' :
                                'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-800 disabled:text-slate-500'
                            }`}
                        >
                            {status === 'sending' && (
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            )}
                            {status === 'idle' && 'Send Message'}
                            {status === 'sending' && 'Sending...'}
                            {status === 'success' && 'Message Sent!'}
                            {status === 'error' && 'Failed to Send'}
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Hidden Iframe for form submission target */}
        <iframe 
            name="contact_form_target" 
            ref={iframeRef}
            className="hidden" 
            title="Form Target"
        />
      </div>
    </div>
  );
};
