
import { ConsoleLog, UserInputRequest } from "../types";

/**
 * Executes the user's code in the browser by creating a dynamic module.
 * It intercepts console.log to stream output to the UI.
 */
export const executeCode = async (
  code: string, 
  onLog: (log: ConsoleLog) => void,
  onGraphUpdate: (mermaidDef: string) => void,
  onUserInteraction: (req: UserInputRequest) => void,
  customApiKey?: string
): Promise<void> => {
  // 1. Ensure API Key is available in the polyfilled process.env
  const win = window as any;
  if (!win.process) {
    win.process = { env: {}, version: '', nextTick: (cb: any) => setTimeout(cb, 0) };
  }
  if (!win.process.env) {
    win.process.env = {};
  }
  
  // Inject keys so the SDKs work naturally
  // Prioritize user-provided key from Settings over the system default
  const apiKey = customApiKey || process.env.API_KEY || '';
  win.process.env.API_KEY = apiKey;
  win.process.env.GOOGLE_API_KEY = apiKey; 

  // 2. Prepare Console Interceptor
  const originalConsole = { 
    log: window.console.log,
    info: window.console.info,
    warn: window.console.warn,
    error: window.console.error,
    debug: window.console.debug
  };

  const intercept = (type: 'info' | 'error' | 'warn' | 'system' | 'verbose', ...args: any[]) => {
    const content = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    onLog({ 
      id: crypto.randomUUID(), 
      type, 
      content, 
      timestamp: new Date().toLocaleTimeString() 
    });
    
    originalConsole.log(`[Captured ${type}]`, ...args); 
  };

  // 3. Patch Global Console
  window.console.log = (...args) => intercept('verbose', ...args);
  window.console.info = (...args) => intercept('info', ...args);
  window.console.warn = (...args) => intercept('warn', ...args);
  window.console.error = (...args) => intercept('error', ...args);
  window.console.debug = (...args) => intercept('system', ...args);

  // 4. Inject Graph Update Hook
  if (onGraphUpdate) {
    win.__setGraphDefinition = (def: string) => {
      onGraphUpdate(def);
    };
  }

  // 5. Inject User Interaction Hooks
  win.promptUser = (message: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      onUserInteraction({
        id: crypto.randomUUID(),
        type: 'text',
        message,
        defaultValue,
        resolve: (val: any) => resolve(val)
      });
    });
  };

  win.confirmUser = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      onUserInteraction({
        id: crypto.randomUUID(),
        type: 'confirm',
        message,
        resolve: (val: any) => resolve(!!val)
      });
    });
  };

  // 6. Create Blob and Import
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    await import(url);
  } finally {
    URL.revokeObjectURL(url);
    // 7. Restore Console & Cleanup
    window.console.log = originalConsole.log;
    window.console.info = originalConsole.info;
    window.console.warn = originalConsole.warn;
    window.console.error = originalConsole.error;
    window.console.debug = originalConsole.debug;
    
    delete win.__setGraphDefinition;
    delete win.promptUser;
    delete win.confirmUser;
  }
};
