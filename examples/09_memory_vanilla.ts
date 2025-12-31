export const CODE_MEMORY_VANILLA = `/**
 * CHAPTER 8: MEMORY SYSTEMS (VANILLA JS)
 *
 * This pattern separates ephemeral conversation history (Short-Term) from persistent facts (Long-Term) to maintain context across multiple sessions. It allows the agent to "remember" user preferences and past decisions without overloading the limited context window.
 * 
 * This agent maintains two types of memory:
 * 1. Short-Term (Episodic): The raw conversation history (Chat Log).
 * 2. Long-Term (Semantic): A "Fact Extractor" runs on every input to 
 *    distill important details into a persistent key-value store.
 * 
 * Architecture:
 * Input -> Fact Extraction (Write to LT Memory) -> Context Stuffing (Read ST + LT) -> Generation
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

// --- MEMORY SYSTEM (The "Database") ---
class MemoryStore {
  constructor() {
    // Short-Term: Exact record of events (Episodic)
    this.episodicHistory = []; 
    // Long-Term: Distilled facts (Semantic)
    this.semanticFacts = {}; 
  }

  addEpisodic(role, text) {
    this.episodicHistory.push({ role, text, timestamp: Date.now() });
  }

  addSemantic(key, value) {
    console.log(\`[MemoryDB] 💾 Writing Fact: \${key} = \${value}\`);
    this.semanticFacts[key] = value;
  }

  getContext() {
    return {
      recentHistory: this.episodicHistory.slice(-5), // Last 5 messages
      knownFacts: this.semanticFacts
    };
  }
}

const memory = new MemoryStore();

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

// Step 1: Semantic Extraction (The "Librarian")
async function extractFacts(userParam, parentId) {
  const span = tracer.startSpan('extractFacts', { userParam }, parentId);
  try {
    console.log("[Memory] Scanning input for new facts...");
    
    const prompt = \`
    Analyze this user message. Extract any PERMANENT facts about the user (name, preferences, location, job).
    Return JSON format: { "key": "value" }.
    If no facts are present, return {}.
    
    User Message: "\${userParam}"
    \`;

    let response = await callGemini(prompt, 0);
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    let facts = {};
    try {
      facts = JSON.parse(response);
    } catch(e) {
      console.warn("Fact parsing failed, ignoring.");
    }

    // Write to Long-Term Memory
    const keys = Object.keys(facts);
    if (keys.length > 0) {
      keys.forEach(k => memory.addSemantic(k, facts[k]));
    } else {
      console.log("[Memory] No new facts found.");
    }

    tracer.endSpan(span.id, facts);
    return { result: facts, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Response Generation (The "Chatbot")
async function generateResponse(userParam, extractionSpanId) {
  const span = tracer.startSpan('generateResponse', { userParam }, extractionSpanId);
  try {
    console.log("[Agent] Recalling context and answering...");
    
    // 1. Update Episodic Memory with the User's Turn FIRST
    // This ensures 'historyStr' includes the current message, preventing prompt duplication.
    memory.addEpisodic("user", userParam);
    
    // 2. Retrieve Memory (now containing the latest user message)
    const context = memory.getContext();
    const historyStr = context.recentHistory
      .map(m => \`\${m.role}: \${m.text}\`)
      .join("\\n");
    const factsStr = JSON.stringify(context.knownFacts, null, 2);

    const prompt = \`
    You are a helpful assistant.
    
    LONG-TERM MEMORY (Facts):
    \${factsStr}
    
    SHORT-TERM MEMORY (History):
    \${historyStr}
    
    Assistant:
    \`;

    const response = await callGemini(prompt, 0.7);
    
    // 3. Update Episodic Memory with the Assistant's Turn
    memory.addEpisodic("assistant", response);

    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Dual-Memory Agent...");

// We simulate a 3-turn conversation to demonstrate memory persistence
const inputs = [
  "Hi, I'm Isabel. I'm a software engineer working with React.",
  "What is the best way to manage state?",
  "Thanks! Can you write a short LinkedIn bio for my profile?" // Tests Long-Term Recall of Name + Job
];

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // We chain the spans sequentially across the loop
  let lastSpanId = null;

  for (const inputMsg of inputs) {
    console.info(\`\\n--- USER INPUT: "\${inputMsg}" ---\`);
    
    // 1. Extract Facts (Long Term)
    const factStep = await extractFacts(inputMsg, lastSpanId);
    
    // 2. Generate Response (Reads Short Term + Long Term)
    const responseStep = await generateResponse(inputMsg, factStep.spanId);
    
    console.info(\`>>> AGENT: \${responseStep.result}\`);
    
    lastSpanId = responseStep.spanId;
  }

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;