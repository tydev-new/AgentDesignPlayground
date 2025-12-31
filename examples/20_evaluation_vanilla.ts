
export const CODE_EVALUATION_VANILLA = `/**
 * CHAPTER 19: EVALUATION & MONITORING (VANILLA JS)
 *
 * This pattern implements "Pairwise Comparison" (A/B Testing), the gold standard for evaluating subjective tasks where a single "correct" answer doesn't exist.
 * 
 * Instead of giving a score (1-10) which varies wildly, we generate two responses 
 * (Baseline vs. Candidate) and ask the Judge: "Which is better?"
 * 
 * Architecture:
 * 1. Dataset: List of test inputs.
 * 2. Agent A (Baseline): The current production prompt/model.
 * 3. Agent B (Candidate): The new experimental prompt/model.
 * 4. Judge: An LLM that compares A vs B and declares a Winner.
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-2.5-flash";

// --- TRACER & DAG UTILITIES ---
class SimpleTracer {
  constructor() {
    this.spans = [];
  }

  // Modified to support multiple parents (Fan-In) for the Judge
  startSpan(name, input = null, parentId = null) {
    const span = {
      id: crypto.randomUUID(),
      name,
      parentId, // Can be string or array
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

// --- TEST DATASET ---
// INPUT: Evaluation Dataset
const DATASET = [
  { 
    id: "TEST-01", 
    input: "Explain quantum entanglement to a 5 year old."
  },
  { 
    id: "TEST-02", 
    input: "I accidentally deleted the production database. What should I do?"
  },
  { 
    id: "TEST-03", 
    input: "Write a short poem about rust (the metal) and Rust (the language)."
  }
];

// --- CORE API LOGIC ---
async function callGemini(textPrompt, temperature = 0) {
  const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL_ID}:generateContent?key=\${API_KEY}\`;
  
  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }],
    generationConfig: { temperature, response_mime_type: "application/json" }
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

// 1. Agent A (Baseline) - Simulates a "Lazy" or minimal agent
async function agentBaseline(input, parentId) {
  const span = tracer.startSpan('Agent_A_Baseline', { input }, parentId);
  try {
    console.log(\`[Baseline] Generating response for: "\${input.substring(0, 20)}..."\`);
    
    // Minimal system instruction
    const prompt = \`
    You are a curt, minimal assistant. Answer the user in 1 sentence.
    User: \${input}
    Return JSON: { "text": "..." }
    \`;

    const response = await callGemini(prompt, 0.5);
    const parsed = JSON.parse(response);
    
    tracer.endSpan(span.id, parsed.text);
    return { result: parsed.text, spanId: span.id };
  } catch(e) { throw e; }
}

// 2. Agent B (Candidate) - Simulates a "Helpful" or detailed agent
async function agentCandidate(input, parentId) {
  const span = tracer.startSpan('Agent_B_Candidate', { input }, parentId);
  try {
    console.log(\`[Candidate] Generating response for: "\${input.substring(0, 20)}..."\`);
    
    // Robust system instruction
    const prompt = \`
    You are an expert teacher. Answer the user with a helpful analogy and clear structure.
    User: \${input}
    Return JSON: { "text": "..." }
    \`;

    const response = await callGemini(prompt, 0.7);
    const parsed = JSON.parse(response);
    
    tracer.endSpan(span.id, parsed.text);
    return { result: parsed.text, spanId: span.id };
  } catch(e) { throw e; }
}

// 3. The Pairwise Judge (A/B Comparison)
async function judgePairwise(input, answerA, answerB, parentIds) {
  // We accept an array of parentIds to visualize the "Fan-In" in the diagram
  const span = tracer.startSpan('Judge_Pairwise', { input }, parentIds);
  try {
    console.log("[Judge] Comparing A vs B...");
    
    const prompt = \`
    Compare two AI responses to the same user input.
    
    Input: "\${input}"
    
    Response A (Baseline): "\${answerA}"
    Response B (Candidate): "\${answerB}"
    
    Which response is better? Consider helpfulness, accuracy, and tone.
    Return JSON: { "winner": "A" | "B" | "Tie", "reason": "short explanation" }
    \`;

    const response = await callGemini(prompt, 0); 
    const evaluation = JSON.parse(response);

    console.log(\`[Judge] Winner: \${evaluation.winner} (\${evaluation.reason})\`);

    tracer.endSpan(span.id, evaluation);
    return { result: evaluation, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Pairwise Evaluation (A/B Testing)...");

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  const results = { A: 0, B: 0, Tie: 0, Total: 0 };
  let previousSpanId = null;

  for (const testCase of DATASET) {
    console.info(\`\\n--- TEST CASE: \${testCase.id} ---\`);
    console.info(\`Input: "\${testCase.input}"\`);
    
    // 1. Run Both Agents in Parallel (Fan-Out)
    // We pass 'previousSpanId' to chain the test cases sequentially in the graph
    const [resA, resB] = await Promise.all([
      agentBaseline(testCase.input, previousSpanId),
      agentCandidate(testCase.input, previousSpanId)
    ]);
    
    console.log(\`> A: \${resA.result}\`);
    console.log(\`> B: \${resB.result}\`);
    
    // 2. Run Judge (Fan-In)
    const evalStep = await judgePairwise(
      testCase.input, 
      resA.result, 
      resB.result, 
      [resA.spanId, resB.spanId]
    );
    
    // Update Stats
    results.Total++;
    if (evalStep.result.winner === 'A') results.A++;
    else if (evalStep.result.winner === 'B') results.B++;
    else results.Tie++;
    
    previousSpanId = evalStep.spanId;
  }

  // --- REPORTING ---
  console.info("\\n--- 📝 A/B TEST REPORT ---");
  
  const winRateB = ((results.B / results.Total) * 100).toFixed(1);
  
  console.info(\`Total Cases: \${results.Total}\`);
  console.info(\`Baseline (A) Wins:  \${results.A}\`);
  console.info(\`Candidate (B) Wins: \${results.B}\`);
  console.info(\`Ties:               \${results.Tie}\`);
  console.info(\`Candidate Win Rate: \${winRateB}%\`);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
