
export const CODE_PARALLELIZATION_VANILLA = `/**
 * CHAPTER 3: PARALLELIZATION (VANILLA JS)
 *
 * This pattern executes multiple independent sub-tasks simultaneously (like a "Map-Reduce" operation) rather than waiting for them sequentially. It drastically reduces latency for tasks like voting, brainstorming, or fetching data from disparate sources.
 * 
 * The agent splits a complex task (Code Review) into independent sub-tasks 
 * (Security, Performance, Style) that run concurrently. 
 * An aggregator node then synthesizes the results.
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-2.5-flash";

// --- TRACER & DAG UTILITIES ---
// Note: Enhanced to support multiple parents (Fan-in) for this specific pattern
class SimpleTracer {
  constructor() {
    this.spans = [];
  }

  // Modified: parentId can be a string OR an array of strings
  startSpan(name, input = null, parentId = null) {
    const span = {
      id: crypto.randomUUID(),
      name,
      parentId, // Can be string or string[]
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

// 1. Security Auditor (Parallel Branch A)
async function securityReview(code, parentId) {
  const span = tracer.startSpan('securityReview', { code }, parentId);
  try {
    console.log("[Security] Scanning for vulnerabilities...");
    const prompt = \`Identify ANY potential security risks in this code (SQL injection, XSS, hardcoded keys). Be brief. Code: \${code}\`;
    const response = await callGemini(prompt);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// 2. Performance Auditor (Parallel Branch B)
async function performanceReview(code, parentId) {
  const span = tracer.startSpan('performanceReview', { code }, parentId);
  try {
    console.log("[Performance] Analyzing complexity...");
    const prompt = \`Analyze the Big O time complexity of this code and suggest 1 optimization. Be brief. Code: \${code}\`;
    const response = await callGemini(prompt);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// 3. Maintainability Auditor (Parallel Branch C)
async function maintainabilityReview(code, parentId) {
  const span = tracer.startSpan('maintainabilityReview', { code }, parentId);
  try {
    console.log("[Style] Checking readability...");
    const prompt = \`Rate the readability (1-5) and naming conventions of this code. Be brief. Code: \${code}\`;
    const response = await callGemini(prompt);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// 4. Aggregator (Fan-in)
async function synthesisReview(reviews, parentIds) {
  // Note: we pass the array of parentIds to the tracer to draw the convergence
  const span = tracer.startSpan('synthesisReview', { reviews }, parentIds);
  try {
    console.log("[Aggregator] Synthesizing final report...");
    const prompt = \`Synthesize these 3 code reviews into a final summary recommendation.
    
    1. Security: \${reviews[0]}
    2. Performance: \${reviews[1]}
    3. Maintainability: \${reviews[2]}
    \`;
    const response = await callGemini(prompt);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Parallel Code Review...");

const inputCode = \`
function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id; // Intentional vulnerability
  return db.execute(query); 
}
\`;

console.info("--- INPUT CODE ---");
console.info(inputCode.trim());

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // FAN-OUT: Start 3 async tasks simultaneously
  // We pass 'null' as parentId so they all connect to START
  const promises = [
    securityReview(inputCode, null),
    performanceReview(inputCode, null),
    maintainabilityReview(inputCode, null)
  ];

  console.log("--- 🔀 FAN-OUT: Running 3 parallel audits ---");
  
  // Wait for all to complete
  const results = await Promise.all(promises);

  console.log("--- 🔄 FAN-IN: All audits complete. Aggregating... ---");

  // Extract results and spanIds for the aggregator
  const reviewTexts = results.map(r => r.result);
  const spanIds = results.map(r => r.spanId);

  // Aggregator Step
  const finalReport = await synthesisReview(reviewTexts, spanIds);

  console.info("--- FINAL REPORT ---");
  console.info(finalReport.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
