
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  definition: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ definition }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter',
      flowchart: {
        htmlLabels: true, // Crucial for <br/> support
        curve: 'basis',
        useMaxWidth: true,
      },
      themeVariables: {
        primaryColor: '#6366f1', // indigo-500
        primaryTextColor: '#fff',
        lineColor: '#94a3b8', // slate-400
        secondaryColor: '#1e293b', // slate-800
        tertiaryColor: '#0f172a', // slate-900
        fontSize: '13px',
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      if (!containerRef.current) return;
      
      try {
        setError(null);
        // Clear previous content immediately
        if (containerRef.current) {
            containerRef.current.innerHTML = '';
        }

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Render SVG asynchronously
        const { svg } = await mermaid.render(id, definition);
        
        // Critical Fix: Check if component is still mounted and ref exists after await
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e: any) {
        console.error("Mermaid rendering failed:", e);
        if (isMounted) {
            setError("Could not render diagram. Ensure the graph structure is valid.");
        }
      }
    };

    renderDiagram();

    return () => {
        isMounted = false;
    };
  }, [definition]);

  return (
    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-start p-4 overflow-auto">
      {error ? (
        <div className="text-slate-500 text-sm text-center italic max-w-xs mt-10">
          {error}
        </div>
      ) : (
        <div ref={containerRef} className="w-full flex justify-center" />
      )}
    </div>
  );
};
