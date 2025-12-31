
export const CODE_RESOURCE_OPTIMIZATION_VANILLA = `/**
 * CHAPTER 16: RESOURCE-AWARE OPTIMIZATION (VANILLA JS)
 *
 * This pattern optimizes the trade-off between cost, latency, and intelligence.
 * Instead of treating all queries equally, the agent acts as a "Triage Nurse",
 * analyzing the complexity of the request to route it to the most efficient model.
 *
 * Architecture:
 * 1. Analyzer (Low-Cost Model): Scores task complexity (1-10).
 * 2. Router: Selects the model.
 *    - Score <= 4: 'gemini-3-flash-preview' (Fast/Cheap)
 *    - Score > 4:  'gemini-3-pro-preview' (Reasoning/Expensive)
 * 3. Cost Tracker: Estimates savings compared to using Pro for everything.
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;

// We define our tier options
const MODELS = {
  FAST: "gemini-3-flash-preview",
  SMART: "gemini-3-pro-preview"
};

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

// --- COST TRACKER UTILITY ---
class CostMonitor {
  constructor() {
    this.totalTokens = 0;
    this.virtualCost = 0; // Arbitrary units
    this.routingDecisions = [];
  }

  track(modelId, inputLen, outputLen) {
    // Rough estimation: 1 char ~= 1 token for simplicity in demo
    const tokens = inputLen + outputLen;
    this.totalTokens += tokens;

    // Simulated Pricing (Flash is 1x, Pro is 10x)
    const multiplier = modelId.includes("flash") ? 1 : 10;
    const cost = tokens * multiplier;
    
    this.virtualCost += cost;
    this.routingDecisions.push({ model: modelId, cost });
    
    console.log(\`[Cost] Used \${modelId}. Cost: \${cost} units.\`);
  }

  report() {
    return {
      totalDecisions: this.routingDecisions.length,
      totalCost: this.virtualCost,
      breakdown: this.routingDecisions
    };
  }
}
const costTracker = new CostMonitor();

// --- CORE API LOGIC (Dynamic Model Support) ---
async function callGemini(textPrompt, modelId, temperature = 0) {
  const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${modelId}:generateContent?key=\${API_KEY}\`;
  
  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }],
    generationConfig: { temperature }
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) throw new Error(\`API Error (\${modelId}): \${response.status}\`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Track Usage
  costTracker.track(modelId, textPrompt.length, text.length);
  
  return text;
}

// --- STEP DEFINITIONS ---

// Step 1: Complexity Analyzer (Always uses Flash)
async function analyzeComplexity(task, parentId) {
  const span = tracer.startSpan('analyzeComplexity', { task }, parentId);
  try {
    console.log("[Triage] Analyzing task complexity...");
    
    const prompt = \`
    Analyze the complexity of this task on a scale of 1-10.
    
    Criteria:
    - 1-4: Simple formatting, lookup, basic greeting, summarization.
    - 5-10: Creative writing, complex coding, math, reasoning, multi-step logic.
    
    Task: "\${task}"
    
    Return JSON: { "score": number, "reason": "string" }
    \`;

    // Use Fast Model for Triage
    let response = await callGemini(prompt, MODELS.FAST, 0);
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    const analysis = JSON.parse(response);
    
    console.log(\`[Triage] Score: \${analysis.score}/10 (\${analysis.reason})\`);
    
    tracer.endSpan(span.id, analysis);
    return { result: analysis, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Executor (Routes to selected model)
async function executeTask(task, analysis, parentId) {
  // Select Model
  const isComplex = analysis.score > 4;
  const selectedModel = isComplex ? MODELS.SMART : MODELS.FAST;
  const label = isComplex ? "PRO_WORKER" : "FLASH_WORKER";
  
  const span = tracer.startSpan(label, { model: selectedModel }, parentId);
  
  try {
    console.log(\`[Router] Routing to \${selectedModel} (\${label})...\`);
    
    const prompt = \`Execute this task:\n\${task}\`;
    const response = await callGemini(prompt, selectedModel, 0.7);
    
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Resource-Aware Optimization Agent...");

const tasks = [
  "What is the capital of France?", // Should be Simple
  "Write a Python script to recursively traverse a directory and hash all files, handling permission errors gracefully." // Should be Complex
];

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  let lastSpanId = null;

  for (const task of tasks) {
    console.info(\`\\n--- NEW TASK: "\${task.substring(0, 50)}..." ---\`);
    
    // 1. Analyze (Always Flash)
    const analysisStep = await analyzeComplexity(task, lastSpanId);
    
    // 2. Execute (Dynamic)
    const executionStep = await executeTask(task, analysisStep.result, analysisStep.spanId);
    
    console.info(\`>>> RESULT: \${executionStep.result.substring(0, 100)}...\`);
    lastSpanId = executionStep.spanId;
  }

  console.info("\\n--- COST SAVINGS REPORT ---");
  const report = costTracker.report();
  console.info(JSON.stringify(report, null, 2));

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
