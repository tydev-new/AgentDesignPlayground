
export const CODE_PRIORITIZATION_VANILLA = `/**
 * CHAPTER 20: PRIORITIZATION WITH AGING (VANILLA JS)
 *
 * This pattern enables an agent to handle a flood of inputs by dynamically scoring and ranking them. 
 * Crucially, it implements "Starvation Prevention" by adding an Aging Factor to the score.
 * 
 * Without Aging: Low priority items (e.g., "Change logo color") are never done.
 * With Aging: Old items slowly gain priority points until they bubble to the top.
 * 
 * Architecture:
 * 1. Evaluator: Scores on Urgency, Impact, and AGE.
 * 2. Sorter: Ranks based on weighted sum.
 * 3. Executor: Processes Top N items.
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

// Step 1: Evaluate a single item (with Aging Logic)
async function evaluateItem(item, parentId) {
  const span = tracer.startSpan('evaluateItem', { id: item.id, age: item.ageHours }, parentId);
  try {
    console.log(\`[Evaluator] Scoring \${item.id} (Age: \${item.ageHours}h): "\${item.desc.substring(0, 30)}..."\`);
    
    const prompt = \`
    Analyze this customer support ticket.
    Ticket: "\${item.desc}"
    
    Score it on:
    1. Urgency (1-10): How soon does it need a fix?
    2. Impact (1-10): How many users does it affect?
    
    Return JSON: { "urgency": number, "impact": number, "reason": "string" }
    \`;

    const response = await callGemini(prompt, 0);
    const scores = JSON.parse(response);
    
    // --- STARVATION PREVENTION FORMULA ---
    // We add 0.1 points for every hour the ticket has been waiting.
    // A 200-hour old "Low Priority" task gets +20 points!
    const ageBonus = item.ageHours * 0.1;
    
    const priorityScore = (scores.urgency * 1.0) + 
                          (scores.impact * 1.5) + 
                          ageBonus;
    
    const result = { 
        ...scores, 
        ageBonus,
        priorityScore, 
        originalItem: item 
    };

    console.log(\`[Evaluator] \${item.id} Final: \${priorityScore.toFixed(1)} (U:\${scores.urgency} + I:\${scores.impact * 1.5} + Age:\${ageBonus.toFixed(1)})\`);
    
    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Executor
async function resolveTicket(ticketData, parentId) {
  const span = tracer.startSpan('resolveTicket', { id: ticketData.originalItem.id }, parentId);
  try {
    console.log(\`[Executor] 🛠️ Resolving \${ticketData.originalItem.id} (Score: \${ticketData.priorityScore.toFixed(1)})...\`);
    
    const prompt = \`
    You are a support agent. Write a 1-sentence response to this issue.
    Issue: \${ticketData.originalItem.desc}
    Context: It was prioritized with score \${ticketData.priorityScore}.
    
    Return JSON: { "response": "string" }
    \`;

    const response = await callGemini(prompt, 0.7);
    const parsed = JSON.parse(response);
    
    tracer.endSpan(span.id, parsed.response);
    return { result: parsed.response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Prioritization Agent (with Starvation Prevention)...");

// INPUT: Backlog with 'ageHours' to simulate waiting time
const inputBacklog = [
  { 
    id: "T-1", 
    desc: "The 'Buy Now' button is throwing a 500 Error for all users!", 
    ageHours: 2 // High Urgency, Low Age
  },
  { 
    id: "T-2", 
    desc: "I don't like the shade of blue in the logo.", 
    ageHours: 200 // Low Urgency, VERY HIGH Age (Starvation Test)
  },
  { 
    id: "T-3", 
    desc: "Add a dark mode feature request.", 
    ageHours: 24 // Med Urgency, Med Age
  },
  { 
    id: "T-4", 
    desc: "Security Alert: SQL Injection vulnerability detected.", 
    ageHours: 1 // Max Urgency, Fresh
  }
];

console.info("--- BACKLOG (UNSORTED) ---");
console.info(JSON.stringify(inputBacklog, null, 2));

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Parallel Evaluation (Fan-Out)
  console.log("--- PHASE 1: SCORING ---");
  const evalPromises = inputBacklog.map(item => evaluateItem(item, null));
  const evaluatedItems = await Promise.all(evalPromises);

  // 2. Sorting Logic
  // Sort descending by Priority Score
  const sortedQueue = evaluatedItems
      .map(e => e.result)
      .sort((a, b) => b.priorityScore - a.priorityScore);

  console.info("\\n--- PRIORITIZED QUEUE ---");
  sortedQueue.forEach((item, idx) => {
    console.info(\`#\${idx + 1} [\${item.originalItem.id}] Score: \${item.priorityScore.toFixed(1)} (Age Bonus: +\${item.ageBonus.toFixed(1)})\`);
  });

  // 3. Execution (Process Top 2)
  console.log("\\n--- PHASE 2: EXECUTION (TOP 2 ONLY) ---");
  const TOP_N = 2;
  
  for (let i = 0; i < TOP_N; i++) {
    const ticket = sortedQueue[i];
    const parentSpanObj = evaluatedItems.find(e => e.result === ticket);
    
    const resolution = await resolveTicket(ticket, parentSpanObj.spanId);
    console.log(\`> RESOLUTION [\${ticket.originalItem.id}]: \${resolution.result}\`);
  }

  const deferredCount = sortedQueue.length - TOP_N;
  if (deferredCount > 0) {
    console.log(\`\\n[System] \${deferredCount} items deferred. Their age will increase for next run.\`);
  }

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
