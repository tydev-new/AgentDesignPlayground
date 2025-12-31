
export const CODE_MULTI_AGENT_VANILLA = `/**
 * CHAPTER 7: MULTI-AGENT COLLABORATION (VANILLA JS)
 *
 * This pattern orchestrates a team of specialized agents (e.g., Researcher, Writer, Reviewer) that collaborate with distinct personas to solve complex problems. It mimics human organizational structures to handle tasks that require diverse, distinct skill sets that a single prompt cannot capture.
 * 
 * Instead of one generalist agent, we define specific "Personas" 
 * that specialize in part of the process. They pass their work 
 * down the assembly line.
 * 
 * Roles:
 * 1. Product Manager: Defines requirements/specs.
 * 2. Engineer: Writes the implementation code.
 * 3. QA Engineer: Writes the test suite.
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
async function callGemini(textPrompt, systemInstruction, temperature = 0.7) {
  const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL_ID}:generateContent?key=\${API_KEY}\`;
  
  // We prepend the System Instruction to the prompt for Vanilla JS simplicity
  // (Or use the proper system_instruction field if using SDK, but here we use raw REST)
  const fullPrompt = \`
  SYSTEM INSTRUCTION: \${systemInstruction}
  
  USER PROMPT: \${textPrompt}
  \`;
  
  const payload = {
    contents: [{ parts: [{ text: fullPrompt }] }],
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

// --- AGENT PERSONAS ---

// Agent 1: Product Manager
async function productManagerAgent(idea, parentId) {
  const span = tracer.startSpan('ProductManager', { idea }, parentId);
  try {
    console.log("[PM] Writing requirements spec...");
    const system = "You are a strict Product Manager. Given a feature idea, write a clear, concise requirements list (bullet points). Focus on 'what', not 'how'.";
    
    const result = await callGemini(idea, system, 0.5);
    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// Agent 2: Software Engineer
async function engineerAgent(specs, parentId) {
  const span = tracer.startSpan('SoftwareEngineer', { specs }, parentId);
  try {
    console.log("[Engineer] Writing implementation code...");
    const system = "You are a Senior Typescript Engineer. Given a list of specs, write a single TypeScript function that implements them. Do not include markdown code blocks, just raw code.";
    
    const result = await callGemini(specs, system, 0.2);
    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// Agent 3: QA Engineer
async function qaAgent(code, parentId) {
  const span = tracer.startSpan('QA_Engineer', { code }, parentId);
  try {
    console.log("[QA] Writing test cases...");
    const system = "You are a QA Automation Engineer. Given a piece of code, write 3 distinct unit test cases (using Jest syntax) to verify it handles edge cases.";
    
    const result = await callGemini(code, system, 0.5);
    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Multi-Agent Workflow...");

const featureIdea = "A function that validates if a string is a valid hex color code (like #FFF or #000000).";
console.info("--- FEATURE IDEA ---");
console.info(featureIdea);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. PM Step
  const specs = await productManagerAgent(featureIdea, null);
  console.info("\\n--- SPECIFICATIONS (PM) ---");
  console.info(specs.result);

  // 2. Engineer Step (Handoff from PM)
  const implementation = await engineerAgent(specs.result, specs.spanId);
  console.info("\\n--- IMPLEMENTATION (Engineer) ---");
  console.info(implementation.result);

  // 3. QA Step (Handoff from Engineer)
  const tests = await qaAgent(implementation.result, implementation.spanId);
  console.info("\\n--- TEST SUITE (QA) ---");
  console.info(tests.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
