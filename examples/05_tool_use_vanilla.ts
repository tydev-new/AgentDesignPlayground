
export const CODE_TOOL_USE_VANILLA = `/**
 * CHAPTER 5: TOOL USE (RAW JSON / VANILLA JS)
 *
 * This pattern enables the agent to step outside its static training data to perform deterministic actions like API calls, database lookups, or calculations. It transforms the LLM from a passive text generator into an active operator that can interact with external systems.
 * 
 * NOTE: This example demonstrates how to implement Tool Use *without* using 
 * the specific Gemini API 'tools' configuration. Instead, we use:
 * 1. Prompt Engineering: Instructing the model to output strict JSON.
 * 2. Manual Parsing: Parsing that JSON in code to determine the function to run.
 * 
 * Architecture:
 * 1. Decide: LLM selects a tool based on the user's prompt (via JSON output).
 * 2. Execute: The runtime parses the JSON and executes the chosen JavaScript function.
 * 3. Generate: LLM incorporates the tool's output into a natural language response.
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

// --- TOOLS (DETERMINISTIC FUNCTIONS) ---

const tools = {
  checkInventory: (itemName) => {
    // Mock database lookup
    const db = {
      "gaming laptop": 42,
      "mechanical keyboard": 15,
      "monitor": 0
    };
    const key = itemName.toLowerCase();
    const stock = db[key] !== undefined ? db[key] : "unknown";
    return \`Inventory for '\${itemName}': \${stock} units.\`;
  },

  calculateTotal: (price, quantity) => {
    // Safe math calculation
    const total = Number(price) * Number(quantity);
    return \`Total cost: $\${total.toFixed(2)}\`;
  }
};

// --- STEP DEFINITIONS ---

// Step 1: Decide which tool to use (Raw Prompting Approach)
async function decideTool(query, parentId) {
  const span = tracer.startSpan('decideTool', { query }, parentId);
  try {
    console.log("[Router] Selecting tool via JSON Prompting...");
    
    // We strictly prompt the model to act as a JSON generator
    const prompt = \`
    You are an Order Assistant. You have access to these tools:
    1. checkInventory(item_name: string) - Check stock levels.
    2. calculateTotal(price: number, quantity: number) - Calculate total cost.
    
    User Query: "\${query}"
    
    Return a JSON object with "tool" (name) and "args" (object).
    If no tool is needed, return { "tool": null, "args": null }.
    
    Examples:
    - "How many laptops do we have?" -> { "tool": "checkInventory", "args": { "item_name": "Gaming Laptop" } }
    - "Cost of 5 items at $20?" -> { "tool": "calculateTotal", "args": { "price": 20, "quantity": 5 } }
    - "Hello!" -> { "tool": null, "args": null }
    \`;

    // Force strict JSON for parsing
    let response = await callGemini(prompt, 0);
    // Cleanup code blocks if present
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    let decision;
    try {
      decision = JSON.parse(response);
    } catch (e) {
      console.warn("Failed to parse JSON, falling back to null tool.");
      decision = { tool: null };
    }

    console.debug(\`[Router] Decision: \${JSON.stringify(decision)}\`);
    tracer.endSpan(span.id, decision);
    return { result: decision, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Execute the selected tool (Deterministic)
async function executeTool(decision, parentId) {
  // If no tool selected, this step is practically a pass-through
  const spanName = decision.tool ? \`execute_\${decision.tool}\` : 'no_tool_execution';
  const span = tracer.startSpan(spanName, decision, parentId);
  
  try {
    console.debug(\`[Tool] Payload: \${JSON.stringify(decision)}\`);

    let output = null;
    if (decision.tool) {
      console.log(\`[Tool] Executing \${decision.tool}...\`);
      
      if (decision.tool === "checkInventory") {
        output = tools.checkInventory(decision.args.item_name);
      } else if (decision.tool === "calculateTotal") {
        output = tools.calculateTotal(decision.args.price, decision.args.quantity);
      } else {
        output = "Error: Unknown tool.";
      }
      
      console.log(\`[Tool] Output: \${output}\`);
    } else {
      console.log("[Tool] No tool required.");
    }
    
    tracer.endSpan(span.id, output);
    return { result: output, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Generate final natural language response
async function generateResponse(originalQuery, toolOutput, parentId) {
  const span = tracer.startSpan('generateResponse', { originalQuery, toolOutput }, parentId);
  try {
    console.log("[Generator] Formulating answer...");
    
    let prompt;
    if (toolOutput) {
       prompt = \`
       User Query: \${originalQuery}
       Tool Output: \${toolOutput}
       
       Answer the user naturally using the tool output.
       \`;
    } else {
       prompt = \`User Query: \${originalQuery}. Answer helpfully.\`;
    }
    
    const response = await callGemini(prompt, 0.7);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Tool Use Agent (Raw JSON Mode)...");

const inputQuery = "Do we have any Gaming Laptops in stock?";
console.info("--- INPUT ---");
console.info(inputQuery);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Decide
  const decisionStep = await decideTool(inputQuery, null);
  
  // 2. Execute
  const toolStep = await executeTool(decisionStep.result, decisionStep.spanId);
  
  // 3. Generate
  const finalStep = await generateResponse(inputQuery, toolStep.result, toolStep.spanId);
  
  console.info("--- FINAL OUTPUT ---");
  console.info(finalStep.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
