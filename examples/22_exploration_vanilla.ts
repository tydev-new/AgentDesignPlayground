
export const CODE_EXPLORATION_VANILLA = `/**
 * CHAPTER 21: EXPLORATION & DISCOVERY (THE CODEBASE ARCHAEOLOGIST)
 *
 * Scenario: "The Legacy Repo Hunter"
 * You just joined a company with a massive, undocumented legacy codebase.
 * You are told: "The 'calculateTax' function is broken. Go fix it."
 * You have no idea where that file lives.
 * 
 * The Agent's Job: 
 * Explore the file tree (graph) by intelligently deciding which folders to open
 * ("services" vs "images") based on the likelihood of them containing the logic.
 * 
 * Pattern: Best-First Search (Heuristic Exploration)
 */

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
const MODEL_ID = "gemini-2.5-flash";

// --- MOCK ENVIRONMENT (The Unknown World) ---
// The agent CANNOT see this whole object at once. It can only "ls" specific paths.
const VIRTUAL_REPO = {
  "root": ["src", "public", "config", "README.md", "package.json"],
  "src": ["components", "services", "utils", "app.js"],
  "public": ["logo.png", "robots.txt", "styles.css"],
  "config": ["db.json", "env.js"],
  "src/components": ["Header.js", "Footer.js", "Cart.js"],
  "src/services": ["auth.js", "payment.js", "shipping.js"], // <-- Target is deeper
  "src/utils": ["formatDate.js", "logger.js"]
};

// The hidden target content
const FILE_CONTENTS = {
  "src/services/payment.js": "export function calculateTax(amount) { return amount * 0.2; }"
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

// --- AGENT TOOLS (SENSORS) ---

// Tool 1: List Files (Expand Node)
function listDir(path) {
  const content = VIRTUAL_REPO[path];
  if (!content) return []; 
  // Return full paths (e.g., "src/services")
  return content.map(item => path === "root" ? item : \`\${path}/\${item}\`);
}

// Tool 2: Read File (Check Goal)
function readFile(path) {
  return FILE_CONTENTS[path] || "// Empty file or unrelated content";
}

// --- STEP DEFINITIONS ---

// Step 1: Heuristic Evaluator
// Decides how likely a path is to contain the target logic
async function scoreRelevance(path, goal, parentId) {
  const span = tracer.startSpan('evaluate_path', { path }, parentId);
  try {
    // Optimization: Skip binary files instantly
    if (path.match(/\\.(png|jpg|css|json|txt|md)$/)) {
        const result = { score: 0, reason: "Static asset", path };
        tracer.endSpan(span.id, result);
        return { result, spanId: span.id };
    }

    const prompt = \`
    We are looking for code related to: "\${goal}".
    
    Current Path: "\${path}"
    
    Rate the probability (0-100) that this path leads to the definition.
    - "services/" or "utils/" are usually High probability for logic.
    - "images/" or "public/" are Zero probability.
    - "payment.js" is extremely high for tax logic.
    
    Return JSON: { "score": number, "reason": "short string" }
    \`;

    let response = await callGemini(prompt, 0);
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    const evalObj = JSON.parse(response);
    evalObj.path = path; // Inject path for tracking
    
    // Detailed logging for every evaluation
    console.log(\`[Heuristic] Analyzed "\${path}" -> Score: \${evalObj.score} (\${evalObj.reason})\`);

    tracer.endSpan(span.id, evalObj);
    return { result: evalObj, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Codebase Archaeologist...");

const SEARCH_GOAL = "function calculateTax";
console.info(\`--- MISSION: Find definition of "\${SEARCH_GOAL}" ---\`);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // Best-First Search Frontier
  // We start at 'root'
  let frontier = [{ path: "root", score: 50, spanId: null }];
  const visited = new Set();
  let found = false;
  
  const MAX_STEPS = 12;

  for (let i = 0; i < MAX_STEPS; i++) {
    if (frontier.length === 0) break;

    // 1. SELECT (Pick highest score)
    frontier.sort((a, b) => b.score - a.score);
    const current = frontier.shift();

    if (visited.has(current.path)) continue;
    visited.add(current.path);

    console.info(\`\\n--- STEP \${i+1}: Exploring "\${current.path}" (Prior Score: \${current.score}) ---\`);

    // 2. CHECK GOAL (Is this a file?)
    const isFile = current.path.includes('.') && !current.path.startsWith('root'); // Simple heuristic for file vs dir
    
    if (isFile) {
        // It's a file, let's read it
        console.log(\`[Action] Reading file content...\`);
        const content = readFile(current.path);
        
        if (content.includes("calculateTax")) {
            console.info(">>> 🎉 TARGET FOUND!");
            console.info(\`File: \${current.path}\`);
            console.info(\`Content: \${content}\`);
            found = true;
            
            // Record success span
            const successSpan = tracer.startSpan('Target_Found', { path: current.path }, current.spanId);
            tracer.endSpan(successSpan.id, "Success");
            break;
        } else {
            console.log(\`[Action] Target not found in file. Continuing...\`);
        }
    } 
    else {
        // 3. EXPAND (It's a directory)
        const children = listDir(current.path);
        console.log(\`[Action] Listing directory: Found \${children.length} items.\`);
        
        if (children.length === 0) continue;

        // 4. SCORE NEW NODES (Parallel)
        const scorePromises = children.map(childPath => {
            if (visited.has(childPath)) return null;
            return scoreRelevance(childPath, SEARCH_GOAL, current.spanId);
        });
        
        const scoredResults = await Promise.all(scorePromises);
        
        // Add valid items to frontier
        for (const item of scoredResults) {
            if (!item) continue;

            if (item.result.score > 10) { // Pruning threshold
                frontier.push({ 
                    path: item.result.path,
                    score: item.result.score,
                    spanId: item.spanId
                });
            } else {
                 console.debug(\`[Pruned] Dropping "\${item.result.path}" (Score: \${item.result.score}) - Too low.\`);
            }
        }
    }
  }

  if (!found) {
    console.warn("❌ Failed to find target within max steps.");
  }

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
