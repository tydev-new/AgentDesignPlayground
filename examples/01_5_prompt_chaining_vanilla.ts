
export const CODE_PROMPT_CHAINING_VANILLA = `/**
 * CHAPTER 1: PROMPT CHAINING (VANILLA JS)
 *
 This pattern decomposes a complex workflow into a sequence of smaller, manageable sub-prompts where the output of one step becomes the input for the next. It prevents the model from losing focus on long tasks and allows for intermediate validation between steps.
 *
 * Key Benefit: Solves the "Cognitive Load" problem. By enforcing a structured linear flow, it dramatically increases reliability compared to a single, overloaded prompt.

 * Flow:
 * Step 1. EXTRACT: Isolate key technical specs from raw marketing text.
 * Step 2. FORMAT: Convert the natural language specs into strict, usable JSON.
 */

// --- 1. CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-3-flash-preview";
const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL_ID}:generateContent?key=\${API_KEY}\`;

// --- 2. TRACER & DAG UTILITIES (Mini Observability Layer) ---

class SimpleTracer {
  constructor() {
    this.spans = [];
    this.startTime = Date.now();
  }

  startSpan(name, input = null, parentId = null) {
    const span = {
      id: crypto.randomUUID(),
      name,
      parentId, // Tracks the 'Edge'
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
    // Send raw spans to UI for rendering
    if (window.__setGraphDefinition) {
      window.__setGraphDefinition(JSON.stringify(this.spans));
    } else {
      console.warn("Graph visualization hook not found.");
    }
  }
}

// Initialize Global Tracer
const tracer = new SimpleTracer();

// --- 3. CORE API LOGIC ---

// Helper: Native Fetch Wrapper
async function callGemini(textPrompt) {
  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }]
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(\`API Request Failed: \${response.status} \${response.statusText}\`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- 4. STEP DEFINITIONS (WRAPPED WITH TRACER) ---

async function extractTechnicalSpecs(rawText) {
  // START SPAN
  const span = tracer.startSpan('extractTechnicalSpecs', { rawText });
  
  try {
    console.log("[Step 1] Extracting specifications...");
    const prompt = \`Extract the technical specifications from: \${rawText}\`;
    
    // Core Logic
    const result = await callGemini(prompt);
    
    // END SPAN
    tracer.endSpan(span.id, result);
    return { result, spanId: span.id }; // Return ID to link next step
  } catch (e) {
    console.error("Step 1 Failed", e);
    throw e;
  }
}

async function formatToJson(specsText, parentSpanId) {
  // START SPAN (Linked to Parent)
  const span = tracer.startSpan('formatToJson', { specsText }, parentSpanId);
  
  try {
    console.log("[Step 2] Formatting to JSON...");
    const prompt = \`Transform specs to JSON keys (cpu, memory, storage) only: \${specsText}\`;
    
    // Core Logic
    const result = await callGemini(prompt);
    const cleaned = result.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    // END SPAN
    tracer.endSpan(span.id, cleaned);
    return { result: cleaned, spanId: span.id };
  } catch (e) {
    console.error("Step 2 Failed", e);
    throw e;
  }
}

// --- 5. EXECUTION FLOW ---

console.log("Starting Vanilla JS Chain with Active Tracing...");

const inputData = "The new laptop model features a 3.5 GHz octa-core processor, 16GB of RAM, and a 1TB NVMe SSD.";
console.info("\\n--- INPUT ---");
console.info(inputData);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // Execute Step A
  const step1 = await extractTechnicalSpecs(inputData);
  console.log("[Result 1]", step1.result);

  // Execute Step B (Pass ID to link edges)
  const step2 = await formatToJson(step1.result, step1.spanId);
  
  console.info("\\n--- FINAL OUTPUT (JSON) ---");
  console.info(step2.result);
  
  // Finalize Visualization
  tracer.publishGraph();

} catch (error) {
  console.error("Chain failed:", error);
}
`;
