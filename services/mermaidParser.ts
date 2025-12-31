
import { Span } from "../types";

/**
 * Helper to wrap text for Mermaid nodes/edges by inserting <br/> tags.
 */
const wrapText = (text: string, maxLen: number = 20): string => {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  
  const words = text.split(/\s+/);
  let lines: string[] = [];
  let currentLine = "";

  words.forEach(word => {
    if (currentLine.length + word.length > maxLen) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });
  
  if (currentLine) lines.push(currentLine.trim());
  return lines.join("<br/>");
};

/**
 * Generates a Mermaid DAG (Flowchart) from runtime Spans.
 * Replaces the logic previously embedded in SimpleTracer.
 */
export const generateRuntimeDAG = (spans: Span[]): string => {
  const lines = ["graph TD"];
  lines.push("  START((START))");
  lines.push("  END((END))");
  
  // Nodes
  spans.forEach(span => {
    const safeName = span.name.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(`  ${safeName}["${span.name}"]`);
  });

  // Edges
  spans.forEach(span => {
    const safeName = span.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (Array.isArray(span.parentId)) {
      span.parentId.forEach(pid => {
        const parent = spans.find(s => s.id === pid);
        if (parent) {
          const parentSafe = parent.name.replace(/[^a-zA-Z0-9]/g, '_');
          lines.push(`  ${parentSafe} --> ${safeName}`);
        }
      });
    } else if (span.parentId) {
      const parent = spans.find(s => s.id === span.parentId);
      if (parent) {
        const parentSafe = parent.name.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`  ${parentSafe} --> ${safeName}`);
      }
    } else {
      lines.push(`  START --> ${safeName}`);
    }
  });

  // End Connections
  spans.forEach(span => {
    const isParent = spans.some(s => {
      if (Array.isArray(s.parentId)) return s.parentId.includes(span.id);
      return s.parentId === span.id;
    });

    if (!isParent) {
      const safeName = span.name.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${safeName} --> END`);
    }
  });

  return lines.join("\n");
};

/**
 * Generates a Mermaid Sequence Diagram from runtime Spans.
 * Uses time-overlap logic to distinguish between "Nested Calls" and "Sequential Steps".
 */
export const generateRuntimeSequence = (spans: Span[]): string => {
  const lines = ["sequenceDiagram"];
  lines.push("  autonumber");
  lines.push("  participant User");
  lines.push("  participant Agent as Agent Loop");

  // Initial Trigger
  lines.push("  User->>Agent: Start Task");
  lines.push("  activate Agent");

  // Sort spans by start time to process linearly
  const sortedSpans = [...spans].sort((a, b) => a.startTime - b.startTime);

  sortedSpans.forEach(span => {
    const safeName = span.name.replace(/[^a-zA-Z0-9]/g, '_');
    let caller = "Agent"; // Default caller is the Main Loop

    // Determine if there is a specific parent span that is ACTUALLY calling this (Stack-wise)
    // Rule: Parent must be running when Child starts.
    if (span.parentId) {
      // Handle array or string parentId
      const parentIds = Array.isArray(span.parentId) ? span.parentId : [span.parentId];
      
      // Look for a parent that was active when this span started
      const activeParent = spans.find(s => {
        if (!parentIds.includes(s.id)) return false;
        
        // Check overlap: Parent Start < Child Start < Parent End (or Parent not ended)
        const parentRunning = s.endTime ? s.endTime > span.startTime : true;
        return parentRunning && s.startTime < span.startTime;
      });

      if (activeParent) {
        caller = activeParent.name.replace(/[^a-zA-Z0-9]/g, '_');
      }
    }

    // Render Call
    lines.push(`  ${caller}->>${safeName}: ${span.name}`);
    lines.push(`  activate ${safeName}`);
    
    // Render Return (Simulated immediately for visualization flow, 
    // or we could track a stack, but flat rendering works well for simple agents)
    lines.push(`  ${safeName}-->>${caller}: return`);
    lines.push(`  deactivate ${safeName}`);
  });

  lines.push("  deactivate Agent");

  return lines.join("\n");
};

/**
 * Simple Regex-based parser to turn Graph code into Mermaid diagrams.
 */
export const parseCodeToMermaid = (code: string): string => {
  const lines = ["graph TD"];
  
  // Normalize code (remove some whitespace for easier regex processing)
  const cleanCode = code.replace(/\s+/g, ' ');

  // Track nodes encountered to define their shapes at the end
  const nodesUsed = new Set<string>();

  // 1. Find nodes explicitly added via .addNode("name", ...)
  const nodeRegex = /\.addNode\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = nodeRegex.exec(cleanCode)) !== null) {
    const nodeId = match[1];
    nodesUsed.add(nodeId);
    // Use wrapped text inside quotes for node label
    lines.push(`  ${nodeId}["${wrapText(nodeId)}"]`);
  }

  // 2. Find standard edges added via .addEdge(START, "node") etc.
  const edgeRegex = /\.addEdge\s*\(\s*([^,]+)\s*,\s*([^)\s,]+)\s*\)/g;
  while ((match = edgeRegex.exec(cleanCode)) !== null) {
    let from = match[1].trim().replace(/['"]/g, '');
    let to = match[2].trim().replace(/['"]/g, '');
    
    nodesUsed.add(from);
    nodesUsed.add(to);
    
    lines.push(`  ${from} --> ${to}`);
  }

  // 3. Find conditional edges
  const condEdgeRegex = /\.addConditionalEdges\s*\(\s*([^,]+)\s*,\s*([^,)]+)(?:\s*,\s*({[^}]+}))?/g;
  while ((match = condEdgeRegex.exec(cleanCode)) !== null) {
    const from = match[1].trim().replace(/['"]/g, '');
    const fnName = match[2].trim();
    const mappingStr = match[3];

    nodesUsed.add(from);

    if (mappingStr) {
      // Try to parse mapping { "label": "node" }
      const pairs = mappingStr.match(/["']?([^"':\s]+)["']?\s*:\s*["']?([^"'} \s,]+)["']?/g);
      if (pairs) {
        pairs.forEach(pair => {
          const [label, target] = pair.split(':').map(s => s.trim().replace(/['"]/g, ''));
          nodesUsed.add(target);
          // Apply wrapping to edge labels too
          lines.push(`  ${from} -.->|${wrapText(label)}| ${target}`);
        });
      }
    } else {
      nodesUsed.add('ConditionalPath');
      lines.push(`  ${from} -.->|${wrapText(fnName)}| ConditionalPath`);
    }
  }

  // 4. Define special shapes for specific IDs if they were used in the graph
  if (nodesUsed.has('START')) {
    lines.push('  START((START))');
  }
  if (nodesUsed.has('END')) {
    lines.push('  END((END))');
  }
  if (nodesUsed.has('ConditionalPath')) {
    lines.push('  ConditionalPath((Decision))');
  }

  // Default fallback if no graph structure detected
  if (lines.length === 1) {
    lines.push("  NoGraph[No Graph structure detected]");
  }

  return lines.join('\n');
};
