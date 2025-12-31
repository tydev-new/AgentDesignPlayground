
export const CODE_REASONING_TECHNIQUES_VANILLA = `/**
 * CHAPTER 17: REASONING TECHNIQUES (SELF-CONSISTENCY) (VANILLA JS)
 *
 * This pattern improves performance on complex reasoning tasks (math, logic riddles) by sampling multiple "Chain of Thought" reasoning paths and selecting the most consistent answer (Majority Voting).
 * 
 * It mimics the human process of "double-checking" work. If an agent makes a probabilistic error in one path, it is unlikely to make the exact same error in parallel paths.
 * 
 * Architecture:
 * 1. Fan-Out: Generate 3 independent reasoning paths (Chain of Thought).
 * 2. Fan-In: Compare the final answers.
 * 3. Consensus: Select the answer that appears most frequently.
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-2.5-flash"; // Flash is great for parallel path generation

// --- TRACER & DAG UTILITIES ---
class SimpleTracer {
  constructor() {
    this.spans = [];
  }

  // Support array of parents for Fan-In
  startSpan(name, input = null, parentId = null) {
    const span = {
      id: crypto.randomUUID(),
      name,
      parentId,
      input,
      output: null,
      status: 'RUNNING',
      startTime: Date.now()
    };
    this.spans.push(span);
    console.debug(\`[Tracer] Started span: \${name}\`);
    return span;
  }

  endSpan(spanId, output) {
    const span = this.spans.find(s => s.id === spanId);
    if (span) {
      span.output = output;
      span.status = 'COMPLETED';
      span.endTime = Date.now();
      console.debug(\`[Tracer] Ended span: \${span.name}\`);
    }
  }

  publishGraph() {
    console.log("\\n--- 📊 TRACE COMPLETE: UPDATING DIAGRAM ---");
    if (window.__setGraphDefinition) {
      window.__setGraphDefinition(JSON.stringify(this.spans));
    }
  }
}
const tracer = new SimpleTracer();

// --- CORE API LOGIC ---
async function callGemini(textPrompt, temperature = 0.7) {
  const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL_ID}:generateContent?key=\${API_KEY}\`;
  
  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }],
    // Higher temperature (0.7) is CRITICAL for Self-Consistency
    // We want diversity in the reasoning paths.
    generationConfig: { temperature }
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) throw new Error(\`API Error: \${response.status}\`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- STEP DEFINITIONS ---

// Step 1: Generate Reasoning Path (Chain of Thought)
async function generateReasoningPath(problem, pathName, parentId) {
  const span = tracer.startSpan(pathName, { problem }, parentId);
  try {
    console.log(\`[Worker] Generating \${pathName}...\`);
    
    // 1. IMPROVED PROMPT: We add examples to force the format
    const prompt = \`
    Solve the following logic puzzle.
    Question: \${problem}
    
    IMPORTANT FORMATTING INSTRUCTIONS:
    - Think step-by-step.
    - You must end your response with exactly this format:
    FINAL ANSWER: [Your Answer Here]
    
    Example:
    ...therefore the rate is constant.
    FINAL ANSWER: 5 minutes
    \`;

    const response = await callGemini(prompt, 0.7);
    
    // 2. ROBUST EXTRACTION LOGIC
    // We now look for 3 patterns:
    // A. Explicit "FINAL ANSWER:" (Our instruction)
    // B. LaTeX Box "boxed{...}" (Standard math model behavior)
    // C. The last sentence if all else fails
    
    let finalAnswer = "Unknown";
    
    // Pattern A: Explicit Instruction
    const explicitMatch = response.match(/FINAL ANSWER:\\s*(.+)/i);
    
    // Pattern B: LaTeX Box (common in math models)
    const boxMatch = response.match(/\\\\boxed\\{([^}]+)\\}/);

    if (explicitMatch) {
       finalAnswer = explicitMatch[1].trim();
    } else if (boxMatch) {
       finalAnswer = boxMatch[1].trim();
    } else {
       // Fallback: Grab the last non-empty line
       const lines = response.trim().split('\\n');
       finalAnswer = lines[lines.length - 1];
    }
    
    // CLEANUP: Remove LaTeX formatting if captured (e.g., "5 \\text{ minutes}" -> "5 minutes")
    finalAnswer = finalAnswer.replace(/\\\\text\\{([^}]+)\\}/g, '$1').trim();

    console.log(\`[Worker] \${pathName} Concluded: "\${finalAnswer}"\`);
    console.log(\`[Worker] \${pathName} Full Trace:\\n\${response}\`);

    const output = { fullReasoning: response, finalAnswer };
    tracer.endSpan(span.id, output);
    return { result: output, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Consensus (Majority Vote)
async function deriveConsensus(solutions, parentIds) {
  const span = tracer.startSpan('Consensus_Vote', { candidateCount: solutions.length }, parentIds);
  try {
    console.log("[Aggregator] Analyzing paths for consensus...");
    
    const answers = solutions.map(s => s.result.finalAnswer);
    const reasoning = solutions.map((s, i) => \`Path \${i+1}: \${s.result.finalAnswer}\`).join("\\n");
    
    console.log(\`[Aggregator] Candidates for Voting:\\n\${reasoning}\`);

    // We use the LLM to judge equivalence (e.g., "5" == "Five")
    const prompt = \`
    I have 3 solutions to a problem. Identify the majority / consensus answer.
    
    Candidates:
    \${reasoning}
    
    If there is a clear majority, output it.
    If they all differ, output "Uncertain".
    Return ONLY the consensus answer string.
    \`;

    const consensus = await callGemini(prompt, 0);
    
    console.log(\`[Aggregator] Winner: "\${consensus}"\`);
    tracer.endSpan(span.id, consensus);
    return { result: consensus, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Self-Consistency Agent...");

// A standard logic trick question
const inputProblem = "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?";

console.info("--- INPUT PROBLEM ---");
console.info(inputProblem);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Fan-Out: Run 3 parallel reasoning paths
  // We want High Temperature (0.7) in callGemini to ensure these paths differ
  const paths = ["Path_A", "Path_B", "Path_C"];
  
  const promises = paths.map(name => 
    generateReasoningPath(inputProblem, name, null)
  );
  
  console.log(\`--- 🔀 FAN-OUT: Spawning \${paths.length} reasoning paths ---\`);
  const solutions = await Promise.all(promises);

  // 2. Fan-In: Aggregate results
  const spanIds = solutions.map(s => s.spanId);
  const finalVerdict = await deriveConsensus(solutions, spanIds);

  console.info("\\n--- FINAL CONSENSUS ---");
  console.info(finalVerdict.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
