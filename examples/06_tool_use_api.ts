
export const CODE_TOOL_USE_API = `/**
 * CHAPTER 5: TOOL USE (NATIVE API)
 *
 * This pattern enables the agent to step outside its static training data to perform deterministic actions like API calls, database lookups, or calculations. It transforms the LLM from a passive text generator into an active operator that can interact with external systems.
 * 
 * Instead of asking the model to "Return JSON" and parsing it manually,
 * we use the Gemini API's native 'tools' configuration. 
 * 
 * This is more robust because the model is fine-tuned to detect when 
 * to call a function and ensures the output matches the schema.
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

// --- TOOL DEFINITIONS (SCHEMA) ---
// These are passed to the API so the model knows what is available.
const toolDefinitions = [
  {
    name: "checkInventory",
    description: "Check stock levels of a product.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_name: { type: "STRING", description: "The product name (e.g., 'Gaming Laptop')" }
      },
      required: ["item_name"]
    }
  },
  {
    name: "calculateTotal",
    description: "Calculate total cost given price and quantity.",
    parameters: {
      type: "OBJECT",
      properties: {
        price: { type: "NUMBER", description: "Price per unit" },
        quantity: { type: "NUMBER", description: "Quantity of items" }
      },
      required: ["price", "quantity"]
    }
  }
];

// --- CORE API LOGIC ---
async function callGemini(textPrompt, tools = null) {
  const API_URL = \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL_ID}:generateContent?key=\${API_KEY}\`;
  
  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }],
  };

  // Inject Native Tools if provided
  if (tools) {
    payload.tools = [{ function_declarations: tools }];
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) throw new Error(\`API Error: \${response.status}\`);
  const data = await response.json();
  
  // Return the full 'Part' object because it might be text OR a functionCall
  return data.candidates?.[0]?.content?.parts?.[0];
}

// --- LOCAL TOOL IMPLEMENTATIONS ---
const localTools = {
  checkInventory: (args) => {
    // Mock database
    const db = { "gaming laptop": 42, "monitor": 0 };
    const key = args.item_name.toLowerCase();
    const stock = db[key] !== undefined ? db[key] : "unknown";
    return \`Inventory for '\${args.item_name}': \${stock} units.\`;
  },
  
  calculateTotal: (args) => {
    const total = Number(args.price) * Number(args.quantity);
    return \`Total: $\${total.toFixed(2)}\`;
  }
};

// --- STEP DEFINITIONS ---

// Step 1: Decide (Model returns a Function Call object)
async function decideTool(query, parentId) {
  const span = tracer.startSpan('decideTool', { query }, parentId);
  try {
    console.log("[Router] Sending query to Gemini with tools...");
    
    // We pass the Tool Schemas here
    const part = await callGemini(query, toolDefinitions);
    
    let decision = { tool: null, args: null };
    
    if (part.functionCall) {
      console.log(\`[Router] Model decided to call: \${part.functionCall.name}\`);
      decision = { 
        tool: part.functionCall.name, 
        args: part.functionCall.args 
      };
    } else {
      console.log("[Router] Model decided to respond with text directly.");
    }

    console.debug(\`[Router] Decision: \${JSON.stringify(decision)}\`);
    tracer.endSpan(span.id, decision);
    return { result: decision, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Execute (Run local JS function)
async function executeTool(decision, parentId) {
  const spanName = decision.tool ? \`execute_\${decision.tool}\` : 'no_tool_exec';
  const span = tracer.startSpan(spanName, decision, parentId);
  try {
    console.debug(\`[Tool] Payload: \${JSON.stringify(decision)}\`);

    let output = null;
    
    if (decision.tool) {
      console.log(\`[Tool] Invoking local function: \${decision.tool}\`);
      const fn = localTools[decision.tool];
      if (fn) {
        output = fn(decision.args);
        console.log(\`[Tool] Result: \${output}\`);
      } else {
        output = "Error: Tool not found.";
      }
    } else {
      output = "No tool execution needed.";
    }

    tracer.endSpan(span.id, output);
    return { result: output, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Generate Final Response
async function generateResponse(originalQuery, toolOutput, parentId) {
  const span = tracer.startSpan('generateResponse', { originalQuery, toolOutput }, parentId);
  try {
    console.log("[Generator] Creating final answer...");
    
    // If we had a tool output, we feed it back to the model
    let prompt;
    if (toolOutput && toolOutput !== "No tool execution needed.") {
       prompt = \`User Query: \${originalQuery}\\nSystem Info: \${toolOutput}\\nAnswer the user.\`;
    } else {
       prompt = originalQuery; // Fallback if no tool was used
    }
    
    // Regular text generation (no tools needed here)
    const part = await callGemini(prompt);
    const text = part.text || "No response generated.";
    
    tracer.endSpan(span.id, text);
    return { result: text, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Tool Use Agent (Native API Mode)...");

const inputQuery = "How much is the total for 5 Gaming Laptops at $1200 each?";
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
