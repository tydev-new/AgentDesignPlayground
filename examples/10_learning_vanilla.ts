
export const CODE_LEARNING_VANILLA = `/**
 * CHAPTER 9: LEARNING & ADAPTATION (VANILLA JS)
 *
 * This pattern accumulates "lessons learned" from past failures into a persistent knowledge base to improve future performance. Instead of updating model weights, it dynamically injects these rules into the context to ensure the agent doesn't repeat the same mistake twice.
 * 
 * Instead of hardcoded if-statements, this agent uses a "Senior Critic" 
 * to evaluate work. If it fails, it "Crystallizes" the failure into a 
 * generalized lesson and stores it in a "Vector-like" Lesson Store.
 * 
 * On the next attempt, it retrieves ONLY relevant lessons to fix the issue.
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

// --- LONG-TERM MEMORY (Simulated Vector Store) ---
class LessonStore {
  constructor() {
    this.lessons = [];
  }

  addLesson(lesson) {
    // Lesson structure: { rule, fix, keywords }
    console.log(\`[LessonStore] 🧠 Crystallizing new knowledge: "\${lesson.rule}"\`);
    this.lessons.push(lesson);
  }

  getRelevantLessons(taskDescription) {
    // Naive "Vector Search" (Keyword Matching)
    // In production, use cosine_similarity(task_embedding, lesson_embedding)
    const taskLower = taskDescription.toLowerCase();
    
    const relevant = this.lessons.filter(l => {
      // If any keyword matches the task, retrieve the lesson
      return l.keywords.some(k => taskLower.includes(k.toLowerCase()));
    });

    if (relevant.length > 0) {
      console.log(\`[LessonStore] 📂 Retrieved \${relevant.length} relevant lessons for this task.\`);
    }
    
    return relevant.map(l => \`❌ AVOID: \${l.rule}\\n✅ INSTEAD: \${l.fix}\`);
  }
}

const store = new LessonStore();

// --- STEP DEFINITIONS ---

// Step 1: Worker (Attempts the task)
async function attemptTask(task, relevantLessons, parentId) {
  const span = tracer.startSpan('attemptTask', { task, lessonCount: relevantLessons.length }, parentId);
  try {
    console.log(\`[Worker] Generating SQL (Lessons active: \${relevantLessons.length})...\`);
    
    let context = "";
    if (relevantLessons.length > 0) {
      context = \`
      CRITICAL PERFORMANCE GUIDELINES (From Memory):
      \${relevantLessons.join("\\n\\n")}
      \`;
    }

    const prompt = \`
    You are a SQL Expert. Write a query for: "\${task}".
    
    \${context}
    
    Output JSON: { "sql": "SELECT ..." }
    \`;

    const response = await callGemini(prompt, 0.5); // JSON mode
    const parsed = JSON.parse(response);
    
    tracer.endSpan(span.id, parsed.sql);
    return { result: parsed.sql, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Critic (The "Senior Engineer" Persona)
async function evaluateResult(code, task, parentId) {
  const span = tracer.startSpan('evaluateResult', { code }, parentId);
  try {
    console.log("[Critic] Reviewing code for performance & safety...");
    
    const prompt = \`
    You are a Senior Principal Data Engineer.
    Review this SQL for performance risks (e.g., SELECT *, missing limits, N+1).
    
    Task: \${task}
    Code: \${code}
    
    Return JSON: { "passed": boolean, "reason": "string" }
    \`;

    const response = await callGemini(prompt, 0);
    const parsed = JSON.parse(response);

    console.log(\`[Critic] Verdict: \${parsed.passed ? "PASS" : "FAIL"} (\${parsed.reason})\`);
    tracer.endSpan(span.id, parsed);
    return { result: parsed, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Learner (The "Crystallizer")
async function extractLesson(feedback, code, parentId) {
  const span = tracer.startSpan('extractLesson', { feedback }, parentId);
  try {
    console.log("[Learner] Generalizing failure into a reusable lesson...");
    
    const prompt = \`
    Analyze this failure.
    Code: \${code}
    Critique: \${feedback}
    
    Create a generalized lesson for future retrieval.
    Return JSON:
    {
      "rule": "Negative Constraint (What NOT to do)",
      "fix": "Positive Example (What to do instead)",
      "keywords": ["tag1", "tag2"]
    }
    \`;

    const response = await callGemini(prompt, 0);
    const lesson = JSON.parse(response);
    
    tracer.endSpan(span.id, lesson);
    return { result: lesson, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Adaptive Learning Agent...");

// Renamed to 'inputTask' so it appears in the "Jump to > Inputs" menu
const inputTask = "Get the emails of all users who signed up in 2024.";

console.info("--- TASK ---");
console.info(inputTask);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  let attempts = 0;
  const MAX_ATTEMPTS = 10;
  let success = false;
  let lastSpanId = null;

  // We use a 'for' loop instead of 'while' here to reduce clutter 
  // in the "Jump to > Loops" navigation menu.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (success) break; // Exit loop if previous attempt passed

    attempts++;
    console.info(\`\\n--- ATTEMPT \${attempts} ---\`);

    // 1. Retrieve Context (RAG)
    const lessons = store.getRelevantLessons(inputTask);

    // 2. Generate
    const attempt = await attemptTask(inputTask, lessons, lastSpanId);
    console.log("Generated SQL:", attempt.result);
    lastSpanId = attempt.spanId;

    // 3. Critique
    const review = await evaluateResult(attempt.result, inputTask, lastSpanId);
    lastSpanId = review.spanId;

    if (review.result.passed) {
      success = true;
      console.info("SUCCESS: Passed Engineering Review.");
    } else {
      // 4. Learn (If failed)
      console.warn("FAILURE DETECTED: Initiating Learning Phase...");
      
      const lessonStep = await extractLesson(review.result.reason, attempt.result, lastSpanId);
      
      // Store in memory
      store.addLesson(lessonStep.result);
      lastSpanId = lessonStep.spanId;
      
      // The Loop continues...
    }
  }

  if (!success) {
    console.error("Agent failed to adapt after max attempts.");
  }

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
