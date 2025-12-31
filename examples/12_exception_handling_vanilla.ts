
export const CODE_EXCEPTION_HANDLING_VANILLA = `/**
 * CHAPTER 12: EXCEPTION HANDLING & ROBUSTNESS (VANILLA JS)
 *
 * This pattern implements a defensive hierarchy (Retry -> Repair -> Fallback) to manage tool failures or malformed data. It ensures the agent fails gracefully or self-heals rather than crashing when encountering the unexpected errors common in non-deterministic systems.
 * 
 * A Senior Engineer's approach to error handling. Instead of immediately
 * asking an LLM to fix an error (which is slow & expensive), we follow a strict hierarchy:
 * 
 * 1. RETRY: Handle transient network blips with exponential backoff.
 * 2. REPAIR: If retries fail, activate the "Healer Agent" to fix malformed data.
 * 3. FALLBACK: If the Healer fails, degrade gracefully to a safe default state.
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

// Step 1: The "Flaky" Tool
// This function simulates a tool that persistently returns malformed JSON
// to force our error handling logic to escalate all the way to "Repair".
async function fetchUserData(userId, attemptNum, parentId) {
  const spanName = \`fetch_attempt_\${attemptNum}\`;
  const span = tracer.startSpan(spanName, { userId, attempt: attemptNum }, parentId);
  try {
    console.log(\`[Tool] Fetching data (Attempt \${attemptNum})...\`);
    
    // DELAY: Simulate network latency
    await new Promise(r => setTimeout(r, 500));

    // ERROR: Intentionally broken JSON (Missing quote, trailing comma)
    const brokenJson = \`{
      name: "Alice",
      role: "Admin",
      "lastLogin": "2023-10-10",
    }\`;
    
    tracer.endSpan(span.id, brokenJson);
    return { result: brokenJson, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: The "Healer" Agent (Repair Layer)
async function repairData(brokenString, errorMsg, parentId) {
  const span = tracer.startSpan('healer_agent', { errorMsg }, parentId);
  try {
    console.warn("[Healer] 🚑 Analyzing malformed data...");
    
    const prompt = \`
    The following JSON string is malformed and caused an error: "\${errorMsg}".
    
    Broken String:
    \${brokenString}
    
    Fix the JSON syntax. Return ONLY the raw valid JSON.
    \`;

    let response = await callGemini(prompt, 0);
    // Sanitize output
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    console.warn("[Healer] Repair complete.");
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: The Orchestrator (Robustness Logic)
// This implements the Retry -> Repair -> Fallback hierarchy
async function robustFetch(userId, parentId) {
  const MAX_RETRIES = 3;
  
  let currentParentId = parentId;
  let lastBrokenData = null;
  let lastError = null;

  // LAYER 1: RETRY LOOP
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      // A. Call Tool
      const step = await fetchUserData(userId, i, currentParentId);
      lastBrokenData = step.result;
      currentParentId = step.spanId; // Chain the graph nodes
      
      // B. Validate (This will throw if JSON is bad)
      const validData = JSON.parse(step.result);
      
      // If we get here, it worked!
      console.log(\`[Orchestrator] Success on attempt \${i}.\`);
      return { result: validData, spanId: step.spanId };

    } catch (e) {
      console.warn(\`[Orchestrator] ⚠️ Attempt \${i} Failed: \${e.message}\`);
      lastError = e;

      // Backoff (Simulated)
      if (i < MAX_RETRIES) {
        console.log(\`[Orchestrator] Retrying in 1s...\`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // LAYER 2: REPAIR (Escalation)
  console.warn("[Orchestrator] 🚨 Retries exhausted. Escalating to Healer Agent...");
  
  try {
    const repairStep = await repairData(lastBrokenData, lastError.message, currentParentId);
    const validData = JSON.parse(repairStep.result);
    return { result: validData, spanId: repairStep.spanId };
  } catch (criticalError) {
    
    // LAYER 3: FALLBACK (Graceful Degradation)
    console.error("[Orchestrator] Healer failed. Loading Safe Fallback.");
    
    const fallbackSpan = tracer.startSpan('load_fallback', { reason: criticalError.message }, currentParentId);
    
    const fallbackData = { 
      name: "Guest User", 
      role: "Guest", 
      notes: "Data unavailable due to system error" 
    };
    
    tracer.endSpan(fallbackSpan.id, fallbackData);
    return { result: fallbackData, spanId: fallbackSpan.id };
  }
}

// Step 4: Business Logic
async function processUser(userObj, parentId) {
  const span = tracer.startSpan('processUser', { userObj }, parentId);
  try {
    console.log("[App] Processing user record...");
    const result = \`Welcome, \${userObj.name}. Access Level: \${userObj.role.toUpperCase()}.\`;
    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Robust Agent (Retry -> Repair -> Fallback)...");

// DEFINING 'inputUserId' EXPLICITLY TO ENABLE 'JUMP TO > INPUTS' NAVIGATION
const inputUserId = "101";

console.info("--- INPUT ---");
console.info(\`Target User ID: \${inputUserId}\`);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Execute Robust Fetch
  // This single call encapsulates the entire complexity of the hierarchy
  const userStep = await robustFetch(inputUserId, null);
  
  console.info("\\n--- FETCH RESULT ---");
  console.info(JSON.stringify(userStep.result, null, 2));

  // 2. Process Data
  const finalStep = await processUser(userStep.result, userStep.spanId);
  
  console.info("\\n--- FINAL OUTPUT ---");
  console.info(finalStep.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
