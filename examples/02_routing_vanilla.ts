
export const CODE_ROUTING_VANILLA = `/**
 * CHAPTER 2: ROUTING (VANILLA JS)
 *
 * This pattern uses a "Gateway" agent to classify user intent and direct the query to the most suitable specialist agent or tool. It optimizes cost and accuracy by ensuring simple queries go to faster models while complex tasks are routed to capable experts.
 * 
 * This demonstrates how to use LLM outputs to control control flow.
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

async function classificationStep(input, parentId) {
  const span = tracer.startSpan('classificationStep', { input }, parentId);
  try {
    console.log("[Router] Analyzing intent...");
    const prompt = \`Classify this query into exactly one category: "TECHNICAL", "REFUND", or "GENERAL".
    Query: "\${input}"
    Return ONLY the category name. Do not explain.\`;

    // Temperature 0 is crucial for consistent routing
    let category = await callGemini(prompt, 0); 
    category = category.trim().toUpperCase().replace(/[^A-Z]/g, '');

    // Fallback normalization
    if (!["TECHNICAL", "REFUND", "GENERAL"].includes(category)) {
        category = "GENERAL";
    }

    console.log(\`[Router] Selected path: \${category}\`);
    tracer.endSpan(span.id, category);
    return { result: category, spanId: span.id };
  } catch (e) {
    console.error("Router failed", e);
    throw e;
  }
}

async function technicalSupportStep(input, parentId) {
  const span = tracer.startSpan('technicalSupport', { input }, parentId);
  try {
    console.log("[Technical] Diagnosing issue...");
    const prompt = \`You are a tier-1 technical support agent. Provide a troubleshooting step for: \${input}\`;
    const response = await callGemini(prompt);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

async function refundStep(input, parentId) {
  const span = tracer.startSpan('processRefund', { input }, parentId);
  try {
    console.log("[Refund] Checking policy...");
    // Simulating a logic check rather than just LLM
    const response = "Refund request logged. Our team will process it within 24-48 hours based on the item condition.";
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

async function generalChatStep(input, parentId) {
  const span = tracer.startSpan('generalChat', { input }, parentId);
  try {
    console.log("[General] Generating response...");
    const response = await callGemini(\`Respond helpfully to: \${input}\`);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Routing Agent (Batch Execution)...");

// We define 3 distinct inputs to demonstrate the router handling different intents
const inputs = [
  "My screen is flickering and goes black occasionally.", // Should go to TECHNICAL
  "I want my money back for this broken item.",          // Should go to REFUND
  "Tell me a fun fact about space."                      // Should go to GENERAL
];

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // Iterate through each input to show the router branching in action
  for (const inputData of inputs) {
    console.info("\\n--- NEW INPUT ---");
    console.info(inputData);

    // 1. Router (Root node for this iteration)
    // We pass 'null' as parentId so it connects to START in the diagram
    const route = await classificationStep(inputData, null);

    // 2. Branching Logic
    let finalResult;
    
    // Note: We pass route.spanId to link the DAG visually
    switch (route.result) {
      case "TECHNICAL":
        finalResult = await technicalSupportStep(inputData, route.spanId);
        break;
      case "REFUND":
        finalResult = await refundStep(inputData, route.spanId);
        break;
      case "GENERAL":
      default:
        finalResult = await generalChatStep(inputData, route.spanId);
        break;
    }

    console.info(\`--- OUTPUT (\${route.result}) ---\`);
    console.info(finalResult.result);
  }

  // Render the combined DAG of all 3 executions
  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
