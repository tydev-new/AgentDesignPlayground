
export const CODE_PLANNING_VANILLA = `/**
 * CHAPTER 6: PLANNING (VANILLA JS)
 *
 * This pattern allows an agent to dynamically break down a high-level, ambiguous goal into a structured sequence of executable steps. It is essential for handling novel problems where the path to the solution isn't known in advance.
 * 
 * Flow:
 * 1. Planner: Decompose goal into a list of tasks (JSON).
 * 2. Executor: Loop through the list and execute each task.
 * 3. Aggregator: Combine results into a final answer.
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

// Step 1: The Planner (Generates JSON)
async function generatePlan(goal, parentId) {
  const span = tracer.startSpan('plannerAgent', { goal }, parentId);
  try {
    console.log("[Planner] Decomposing goal into steps...");
    
    const prompt = \`
    Goal: "\${goal}"
    
    Break this goal down into 3 distinct, sequential steps to research and summarize the topic.
    Return ONLY a raw JSON array of strings. No markdown.
    
    Example output: ["Define the concept", "Explain the history", "Describe future trends"]
    \`;

    let response = await callGemini(prompt, 0);
    // Sanitize
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    let plan = [];
    try {
      plan = JSON.parse(response);
      if (!Array.isArray(plan)) throw new Error("Not an array");
    } catch (e) {
      console.warn("JSON parse failed, using fallback plan.");
      plan = ["Research topic basics", "Analyze key factors", "Summarize findings"];
    }

    console.log(\`[Planner] Generated \${plan.length} steps.\`);
    tracer.endSpan(span.id, plan);
    return { result: plan, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: The Executor (Worker)
async function executeStep(task, context, parentId) {
  const span = tracer.startSpan('executeTask', { task }, parentId);
  try {
    console.log(\`[Executor] Working on: "\${task}"...\`);
    
    const prompt = \`
    Task: \${task}
    Context so far: \${JSON.stringify(context)}
    
    Provide a concise paragraph (max 2 sentences) executing this task.
    \`;

    const response = await callGemini(prompt, 0.7);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: The Aggregator
async function synthesizeReport(goal, findings, parentIds) {
  // We use the last step's ID as parent, or all of them if parallel (here it's sequential)
  const span = tracer.startSpan('synthesizeReport', { findings }, parentIds);
  try {
    console.log("[Aggregator] compiling final answer...");
    
    const prompt = \`
    Goal: \${goal}
    
    Research Findings:
    \${findings.join("\\n")}
    
    Write a cohesive summary report based on these findings.
    \`;

    const response = await callGemini(prompt, 0.7);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Planning Agent (Plan-and-Execute)...");

const userGoal = "Explain the history and future of the Rust programming language.";
console.info("--- GOAL ---");
console.info(userGoal);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Plan
  const planStep = await generatePlan(userGoal, null);
  const taskList = planStep.result;
  
  console.info("--- PLAN GENERATED ---");
  console.info(JSON.stringify(taskList, null, 2));

  // 2. Execute Loop
  const findings = [];
  let previousSpanId = planStep.spanId;
  const executionSpanIds = [planStep.spanId];

  for (const task of taskList) {
    // Chain the execution steps sequentially in the graph
    const stepResult = await executeStep(task, findings, previousSpanId);
    
    findings.push(stepResult.result);
    previousSpanId = stepResult.spanId; // Update parent for next step (Chain)
    executionSpanIds.push(stepResult.spanId);
    
    console.log(\`> Finished: \${task}\`);
  }

  // 3. Synthesize
  // We link to the last execution step to show completion
  const finalReport = await synthesizeReport(userGoal, findings, previousSpanId);

  console.info("--- FINAL REPORT ---");
  console.info(finalReport.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
