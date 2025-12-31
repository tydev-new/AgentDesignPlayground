
export const CODE_GOAL_SETTING_VANILLA = `/**
 * CHAPTER 11: GOAL SETTING & MONITORING (VANILLA JS)
 *
 * This pattern decomposes high-level objectives into measurable KPIs and actively tracks progress against them using real-time data. It enables the agent to detect when it is "off-track" and automatically trigger remediation plans to fix the issue.
 *
 * Unlike a passive dashboard, this agent actively monitors KPIs.
 * If a metric falls below target (RED), it automatically triggers
 * a remediation agent to generate a fix plan.
 *
 * Architecture (DAG):
 * Goal -> Decompose -> [Milestone 1, Milestone 2, Milestone 3]
 *            |             |             |
 *         Monitor       Monitor       Monitor
 *            |             |             |
 *          Green         Green          RED
 *                                        |
 *                                    Remediate (Fix Plan)
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

// --- MOCK TOOLING (METRIC REGISTRY) ---
// In a real app, this would fetch from Datadog, Stripe, or Google Analytics.
const metricDatabase = {
  "Daily Visitors": 1050,      // Target 1000 -> GREEN
  "Open Rate %": 22,           // Target 20   -> GREEN
  "Conversion Rate %": 2.1     // Target 5    -> RED (FAILURE)
};

async function fetchMetricData(metricName) {
  // Simulate API latency
  await new Promise(r => setTimeout(r, 500));
  // Default to 0 if not found, or strict lookup
  return metricDatabase[metricName] || 0;
}

// --- STEP DEFINITIONS ---

// Step 1: Decompose High-Level Goal
async function setMilestones(goal, parentId) {
  const span = tracer.startSpan('setMilestones', { goal }, parentId);
  try {
    console.log("[Planner] Breaking goal into measurable milestones...");

    const prompt = \`
    Goal: "\${goal}"

    Define exactly 3 key milestones.
    For each, assign a metric name that MUST match one of these keys:
    ["Daily Visitors", "Open Rate %", "Conversion Rate %"].
    Assign a sensible numeric target.

    Return JSON array: [{ "name": string, "metric": string, "target": number }]
    \`;

    const response = await callGemini(prompt, 0);
    const milestones = JSON.parse(response);

    tracer.endSpan(span.id, milestones);
    return { result: milestones, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Monitor Progress (Compare Actual vs Target)
async function evaluateProgress(milestone, actualValue, parentId) {
  // Create a unique node name for the diagram
  const nodeName = \`check_\${milestone.metric.replace(/\\s|%/g,'')}\`;
  const span = tracer.startSpan(nodeName, { milestone, actualValue }, parentId);
  try {
    console.log(\`[Monitor] Checking \${milestone.name} (Actual: \${actualValue} vs Target: \${milestone.target})...\`);

    const prompt = \`
    Milestone: \${milestone.name}
    Target: \${milestone.target}
    Actual: \${actualValue}

    Is this On Track?
    Return JSON: { "status": "GREEN" | "RED", "reason": "string" }
    Rule: RED if Actual is < 90% of Target. GREEN otherwise.
    \`;

    const response = await callGemini(prompt, 0);
    const statusObj = JSON.parse(response);

    console.log(\`[Monitor] Status: \${statusObj.status} (\${statusObj.reason})\`);

    tracer.endSpan(span.id, statusObj);
    return { result: statusObj, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Remediate Failure (The "Self-Healing" Branch)
async function remediateFailure(milestone, failureReason, parentId) {
  const span = tracer.startSpan('remediate_plan', { failure: failureReason }, parentId);
  try {
    console.warn(\`[Healer] 🚨 Alert triggered for \${milestone.name}. Generating fix...\`);

    const prompt = \`
    The milestone "\${milestone.name}" has FAILED.
    Metric: \${milestone.metric}
    Reason: \${failureReason}

    Generate a specific, 1-step remediation plan to fix this underperformance.
    Return JSON: { "action": "string", "priority": "HIGH" }
    \`;

    const response = await callGemini(prompt, 0.7);
    const plan = JSON.parse(response);

    console.warn(\`[Healer] Fix Proposed: \${plan.action}\`);

    tracer.endSpan(span.id, plan);
    return { result: plan, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Active Monitoring Agent...");

const inputGoal = "Successfully launch a new SaaS product in Q1.";
console.info("--- GOAL ---");
console.info(inputGoal);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Set Goals
  const plan = await setMilestones(inputGoal, null);
  console.info("\\n--- MILESTONES DEFINED ---");
  console.info(JSON.stringify(plan.result, null, 2));

  const milestones = plan.result;

  // 2. Active Monitoring Loop
  console.info("\\n--- MONITORING PHASE ---");

  for (const item of milestones) {
    // A. Fetch Data (Simulated Tool)
    const actual = await fetchMetricData(item.metric);

    // B. Evaluate Status
    // We link the monitor step to the planning step (fan-out from plan)
    const evalStep = await evaluateProgress(item, actual, plan.spanId);

    // C. Conditional Self-Healing
    if (evalStep.result.status === "RED") {
      // Branch off the evaluation node
      await remediateFailure(item, evalStep.result.reason, evalStep.spanId);
    }
  }

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
