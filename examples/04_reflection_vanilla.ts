
export const CODE_REFLECTION_VANILLA = `/**
 * CHAPTER 4: REFLECTION (VANILLA JS)
 *
 * This pattern forces the agent to critique and refine its own output in a loop before showing the final answer to the user. It is used to catch hallucinations, logic errors, or safety violations that often occur in a "first draft" generation.
 * 
 * The agent generates an initial output, explicitly critiques it 
 * to identify flaws (bugs, tone, edge cases), and then generates 
 * a refined version based on that self-correction.
 * 
 * This improves robustness compared to a "zero-shot" generation.
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-2.5-flash";

// --- TRACER & DAG UTILITIES ---
class SimpleTracer {
  constructor() {
    this.spans = [];
  }

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
async function callGemini(textPrompt, temperature = 0) {
  const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL_ID}:generateContent?key=\${API_KEY}\`;
  
  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }],
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

// Step 1: Generate a quick, initial draft
async function generateDraft(goal, parentId) {
  const span = tracer.startSpan('generateDraft', { goal }, parentId);
  try {
    console.log("[Generator] Drafting initial solution...");
    const prompt = \`Write a Python function for this goal. Keep it simple, do not worry about optimization yet.
    Goal: \${goal}\`;
    
    const response = await callGemini(prompt, 0.7);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Critique the draft (The Reflection)
async function critiqueCode(code, parentId) {
  const span = tracer.startSpan('critiqueCode', { code }, parentId);
  try {
    console.log("[Critic] Reviewing code for efficiency and edge cases...");
    const prompt = \`Review this Python code. Identify any performance issues (Big O) or missing edge cases. 
    Be critical.
    
    Code:
    \${code}\`;
    
    const response = await callGemini(prompt, 0);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Refine based on critique
async function refineCode(originalCode, critique, parentId) {
  const span = tracer.startSpan('refineCode', { originalCode, critique }, parentId);
  try {
    console.log("[Generator] Rewriting code based on feedback...");
    const prompt = \`Rewrite the following Python code to address the critique.
    
    Original Code:
    \${originalCode}
    
    Critique:
    \${critique}
    
    Provide ONLY the optimized Python code.\`;
    
    const response = await callGemini(prompt, 0.2);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Reflection Agent...");

// A classic problem where naive recursion is terrible (O(2^n))
const inputTask = "Calculate the nth Fibonacci number.";

console.info("--- INPUT TASK ---");
console.info(inputTask);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Initial Draft
  const draft = await generateDraft(inputTask, null);
  console.log("--- 1. INITIAL DRAFT (Intermediate) ---");
  console.log(draft.result);

  // 2. Reflection (Critique)
  // We link this to the draft's spanId
  const critique = await critiqueCode(draft.result, draft.spanId);
  console.log("--- 2. CRITIQUE (Intermediate) ---");
  console.log(critique.result);

  // 3. Refinement
  // We link this to the critique's spanId
  const final = await refineCode(draft.result, critique.result, critique.spanId);
  console.info("--- 3. REFINED SOLUTION (Final) ---");
  console.info(final.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
