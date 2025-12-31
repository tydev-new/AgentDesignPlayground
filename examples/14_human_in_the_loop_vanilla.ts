
export const CODE_HUMAN_IN_THE_LOOP_VANILLA = `/**
 * CHAPTER 13: HUMAN-IN-THE-LOOP (VANILLA JS)
 *
 * This pattern introduces a "pause and wait" mechanism that requires human approval before the agent executes high-stakes actions. It is essential for sensitive workflows—like financial transactions or deploying code—where algorithmic decision-making must be validated by human judgment to ensure safety and alignment.
 *
 * In this example, we simulate the "Human" using the Playground's 
 * async interaction helpers: confirmUser() and promptUser().
 * 
 * Flow:
 * Draft -> Human Review -> (If Rejected: Feedback -> Refine -> Loop) -> Execute
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-2.5-flash";

// --- USER CONTEXT (SIMULATED SESSION) ---
const CURRENT_USER = {
  name: "Aiden",
  title: "Director of Customer Success",
  company: "AceTech"
};

// Calculate 6 hours ago for dynamic realism
const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
const timeString = sixHoursAgo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const CUSTOMER_CONTEXT = {
  name: "Betaworks",
  issue: \`Critical Server Outage (started today at \${timeString})\`
};

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

// Step 1: Draft
async function generateDraft(topic, parentId) {
  const span = tracer.startSpan('generateDraft', { topic }, parentId);
  try {
    console.log("[Agent] Drafting response...");
    
    // Injecting Context into the prompt
    const prompt = \`
    You are writing an email for \${CURRENT_USER.company}.
    Sender: \${CURRENT_USER.name} (\${CURRENT_USER.title}).
    Recipient: \${CUSTOMER_CONTEXT.name}.
    Topic: \${topic}
    
    Write a concise, professional email.
    \`;
    
    const response = await callGemini(prompt, 0.7);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Human Review (The Pause)
async function humanReview(draft, parentId) {
  const span = tracer.startSpan('humanReview', { draft }, parentId);
  try {
    console.log("[Human] 🛑 Execution Paused for Manual Review...");
    console.info("--- DRAFT FOR REVIEW ---");
    console.info(draft);

    // 1. Ask for Approval via UI Panel (Async)
    const approved = await confirmUser(
      "REVIEW REQUIRED:\\n" + 
      "Approve this draft for sending?\\n\\n" + 
      "(Check the console output for full text)"
    );

    let feedback = "Approved";
    let auditData = null;
    
    if (approved) {
      // CAPTURE AUDIT TRAIL
      auditData = {
        approver: CURRENT_USER.name,
        title: CURRENT_USER.title,
        company: CURRENT_USER.company,
        timestamp: new Date().toLocaleString()
      };
    } else {
      // 2. If rejected, ask for feedback via UI Panel (Async)
      console.log("[Human] Draft Rejected. Waiting for feedback...");
      const userFeedback = await promptUser(
        "REJECTION FEEDBACK:\\nWhat specifically needs to be changed?", 
        "Make it shorter and more friendly."
      );
      
      feedback = userFeedback || "General revision needed.";
    }

    const result = { approved, feedback, auditData };
    
    console.log(\`[Human] Decision: \${approved ? "✅ APPROVED" : "❌ REJECTED"}\`);
    if (!approved) console.log(\`[Human] Feedback: "\${feedback}"\`);

    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Refine (If rejected)
async function refineDraft(originalDraft, feedback, parentId) {
  const span = tracer.startSpan('refineDraft', { feedback }, parentId);
  try {
    console.log("[Agent] Refining based on feedback...");
    const prompt = \`
    Original Draft: \${originalDraft}
    
    Reviewer Feedback: \${feedback}
    
    Rewrite the email to address the feedback perfectly.
    \`;
    
    const response = await callGemini(prompt, 0.7);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 4: Execute (If approved)
async function sendEmail(content, auditData, parentId) {
  const span = tracer.startSpan('sendEmail', { contentLength: content.length }, parentId);
  try {
    console.log("[System] 🚀 Sending Email...");
    await new Promise(r => setTimeout(r, 1000)); // Simulate API call
    
    let result = "Email queued for delivery. Message ID: <" + crypto.randomUUID().split('-')[0] + ">";

    // APPEND AUDIT TRAIL TO OUTPUT
    if (auditData) {
      result += \`\\n\\n--- 🔐 AUDIT TRAIL ---\\n\`;
      result += \`✅ Approved by: \${auditData.approver} (\${auditData.title} @ \${auditData.company})\\n\`;
      result += \`🕒 Timestamp: \${auditData.timestamp}\`;
    }

    tracer.endSpan(span.id, result);
    return { result, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Human-in-the-Loop Agent...");

// Using the context constant for the input topic description
const inputTopic = \`Apologize to \${CUSTOMER_CONTEXT.name} for \${CUSTOMER_CONTEXT.issue} and offer 10% credit.\`;
console.info("--- INPUT TOPIC ---");
console.info(inputTopic);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  let currentDraftStep = await generateDraft(inputTopic, null);
  let lastSpanId = currentDraftStep.spanId;
  let isApproved = false;
  let finalAuditData = null;
  
  const MAX_LOOPS = 3;
  let loopCount = 0;

  // The Feedback Loop
  while (!isApproved && loopCount < MAX_LOOPS) {
    loopCount++;
    console.info(\`\\n--- REVIEW CYCLE \${loopCount} ---\`);

    // 1. Human Review
    const reviewStep = await humanReview(currentDraftStep.result, lastSpanId);
    lastSpanId = reviewStep.spanId;

    if (reviewStep.result.approved) {
      isApproved = true;
      finalAuditData = reviewStep.result.auditData;
    } else {
      // 2. Refine (if rejected)
      currentDraftStep = await refineDraft(currentDraftStep.result, reviewStep.result.feedback, lastSpanId);
      lastSpanId = currentDraftStep.spanId;
    }
  }

  if (isApproved) {
    // 3. Final Execution (Pass Audit Data)
    const finalStep = await sendEmail(currentDraftStep.result, finalAuditData, lastSpanId);
    console.info("\\n--- FINAL OUTPUT ---");
    console.info(finalStep.result);
  } else {
    console.error("Workflow aborted: Maximum review cycles reached or user cancelled.");
  }

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
