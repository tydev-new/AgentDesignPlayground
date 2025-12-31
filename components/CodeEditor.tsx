
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MermaidDiagram } from './MermaidDiagram';
import { parseCodeToMermaid, generateRuntimeDAG, generateRuntimeSequence } from '../services/mermaidParser';
import { Span } from '../types';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  disabled?: boolean;
  runtimeSpans?: Span[] | null;
  isModified?: boolean;
  onRevert?: () => void;
}

type SymbolType = 'section' | 'input' | 'loop' | 'function' | 'class' | 'graph';

interface Symbol {
  name: string;
  index: number;
  type: SymbolType;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange, 
  disabled, 
  runtimeSpans, 
  isModified, 
  onRevert 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<'editor' | 'diagram'>('editor');
  const [diagramType, setDiagramType] = useState<'DAG' | 'SEQUENCE'>('DAG');
  
  // Parse symbols from code
  const symbols = useMemo(() => {
    const list: Symbol[] = [];
    
    // 1. Sections (// --- HEADER ---)
    const sectionRegex = /\/\/\s*-{3}\s*(.+?)\s*-{3}/g;
    let match;
    while ((match = sectionRegex.exec(code)) !== null) {
      list.push({ name: `§ ${match[1].trim()}`, index: match.index, type: 'section' });
    }

    // 2. Graph Definition (Generic state graph support + SimpleTracer)
    const graphRegex = /new\s+(?:StateGraph|SimpleTracer)\s*\(/g;
    while ((match = graphRegex.exec(code)) !== null) {
      list.push({ name: 'Graph Setup', index: match.index, type: 'graph' });
    }

    // 3. Classes
    const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
    while ((match = classRegex.exec(code)) !== null) {
      list.push({ name: `Class: ${match[1]}`, index: match.index, type: 'class' });
    }

    // 4. Functions (Nodes/ Steps)
    // Matches "async function name(" or "function name("
    const funcRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g;
    while ((match = funcRegex.exec(code)) !== null) {
      list.push({ name: `Fn: ${match[1]}`, index: match.index, type: 'function' });
    }

    // 5. Agent Loops
    // Matches "while(true)" or "while (condition)"
    const loopRegex = /while\s*\(([^)]+)\)/g;
    while ((match = loopRegex.exec(code)) !== null) {
      list.push({ name: `↺ Loop: ${match[1]}`, index: match.index, type: 'loop' });
    }

    // 6. Inputs
    // Pattern A: Common variables (input*, task, goal, etc.)
    const inputVarRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]*[Ii]nput[a-zA-Z0-9_]*|tasks?|userGoal|intent|featureIdea|query|topic|problem|goal|question|dataset|testCases)\s*=/g;
    while ((match = inputVarRegex.exec(code)) !== null) {
      list.push({ name: `Input: ${match[1]}`, index: match.index, type: 'input' });
    }

    // Pattern B: Explicit Input Comments (e.g., // INPUT: ...)
    const inputCommentRegex = /\/\/\s*(?:INPUT|GOAL|TASK):?\s*(.*)/g;
    while ((match = inputCommentRegex.exec(code)) !== null) {
        // Avoid duplicate if it matches the Section regex above (starts with ---)
        if (!match[0].includes('---')) {
            const label = match[1].trim() || "Definition";
            list.push({ name: `Input: ${label}`, index: match.index, type: 'input' });
        }
    }

    return list;
  }, [code]);

  const mermaidDefinition = useMemo(() => {
    // 1. Runtime Diagram (Priority)
    if (runtimeSpans && runtimeSpans.length > 0) {
      if (diagramType === 'SEQUENCE') {
        return generateRuntimeSequence(runtimeSpans);
      } else {
        return generateRuntimeDAG(runtimeSpans);
      }
    }
    
    // 2. Static Analysis (Fallback)
    const staticDef = parseCodeToMermaid(code);
    
    if (staticDef.includes("NoGraph[No Graph structure detected]")) {
      return null;
    }

    return staticDef;
  }, [code, runtimeSpans, diagramType]);

  const handleJumpTo = (index: number) => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(index, index);
      
      const lineHeight = 24; 
      const paddingTop = 16; 
      const lineIndex = code.substring(0, index).split('\n').length - 1;
      
      const lineY = (lineIndex * lineHeight) + paddingTop;
      const viewHeight = el.clientHeight;
      
      el.scrollTop = lineY - (viewHeight / 2) + (lineHeight / 2);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const value = e.currentTarget.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const renderOptions = (type: SymbolType, label: string) => {
    const items = symbols.filter(s => s.type === type);
    if (items.length === 0) return null;
    return (
      <>
        <option disabled className="font-bold bg-slate-800 text-slate-500">── {label} ──</option>
        {items.map((s, i) => (
          <option key={`${type}-${i}`} value={s.index} className="text-slate-300">
            &nbsp;&nbsp;{s.name}
          </option>
        ))}
      </>
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 text-slate-300 border border-slate-700 rounded-lg overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="flex bg-slate-900/80 rounded-md p-0.5 border border-slate-700 shrink-0">
            <button
              onClick={() => setView('editor')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${view === 'editor' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              EDITOR
            </button>
            <button
              onClick={() => setView('diagram')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${view === 'diagram' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              DIAGRAM
            </button>
          </div>

          {view === 'diagram' && (
            <div className="flex items-center gap-2 shrink-0">
               {runtimeSpans ? (
                  <div className="relative">
                    <select
                      value={diagramType}
                      onChange={(e) => setDiagramType(e.target.value as 'DAG' | 'SEQUENCE')}
                      className="appearance-none bg-slate-900/50 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] font-bold rounded px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer pr-6"
                    >
                      <option value="DAG">DAG VIEW</option>
                      <option value="SEQUENCE">SEQUENCE</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-400">
                      <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
               ) : (
                 <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase truncate">
                    Static Analysis
                 </span>
               )}
            </div>
          )}
          
          {view === 'editor' && (
            <div className="relative flex-1 max-w-[140px] min-w-0">
              <select
                onChange={(e) => handleJumpTo(parseInt(e.target.value))}
                value=""
                className="appearance-none w-full bg-slate-900/50 border border-slate-700 hover:border-slate-600 text-slate-400 text-[10px] font-medium rounded px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer pr-6 truncate"
              >
                <option value="" disabled>Jump to...</option>
                {renderOptions('section', 'SECTIONS')}
                {renderOptions('input', 'INPUTS')}
                {renderOptions('loop', 'LOOPS')}
                {renderOptions('function', 'FUNCTIONS')}
                {renderOptions('class', 'CLASSES')}
                {renderOptions('graph', 'GRAPH')}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-400">
                 <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                 </svg>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isModified && (
            <button
              onClick={onRevert}
              title="Revert to original sample code"
              className="flex items-center justify-center p-1.5 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 hover:text-white transition-all active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {view === 'editor' ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            spellCheck={false}
            className="absolute inset-0 w-full h-full p-4 bg-slate-900 text-slate-300 code-font text-sm leading-6 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            placeholder="// Write your agent code here..."
          />
        ) : (
          mermaidDefinition ? (
            <MermaidDiagram definition={mermaidDefinition} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">Run pattern to generate Diagram</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
