
export const CODE_MCP_VANILLA = `/**
 * CHAPTER 10: MODEL CONTEXT PROTOCOL (MCP) (VANILLA JS)
 *
 * This pattern implements a universal client-server standard that decouples the agent from its tools. It allows an agent to dynamically discover and connect to new data sources or capabilities at runtime without requiring code changes.
 *
 * This advanced example demonstrates the true power of MCP:
 * The Agent acts as a "Universal Client" that connects to MULTIPLE 
 * distinct servers (Database + FileSystem), discovers their tools 
 * dynamically, and orchestrates a workflow across them.
 * 
 * It also visualizes the "MCP Handshake" (JSON-RPC) in the Sequence Diagram.
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

// --- 1. SIMULATED MCP SERVERS ---

// Server A: Database
class MockDatabaseServer {
  constructor() {
    this.name = "DatabaseServer";
    this.db = [
      { id: 1, name: "Alice", role: "admin", email: "alice@corp.com" },
      { id: 2, name: "Bob", role: "user", email: "bob@corp.com" },
      { id: 3, name: "Charlie", role: "admin", email: "charlie@corp.com" }
    ];
  }

  async handleMessage(request) {
    // 1. Handshake
    if (request.method === "initialize") {
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: this.name, version: "1.0.0" }
      };
    }

    // 2. Discovery
    if (request.method === "tools/list") {
      return {
        tools: [{
          name: "query_users",
          description: "Find users by role (admin/user). Returns JSON list.",
          inputSchema: {
            type: "object",
            properties: { role: { type: "string" } },
            required: ["role"]
          }
        }]
      };
    }

    // 3. Execution
    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      if (name === "query_users") {
        const results = this.db.filter(u => u.role === args.role);
        return { content: [{ type: "text", text: JSON.stringify(results) }] };
      }
    }
    throw new Error(\`Method \${request.method} not found on \${this.name}\`);
  }
}

// Server B: File System
class MockFileSystemServer {
  constructor() {
    this.name = "FileSystemServer";
    this.files = {};
  }

  async handleMessage(request) {
    if (request.method === "initialize") {
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: this.name, version: "1.0.0" }
      };
    }

    if (request.method === "tools/list") {
      return {
        tools: [{
          name: "write_file",
          description: "Write text content to a file. Overwrites if exists.",
          inputSchema: {
            type: "object",
            properties: { 
              filename: { type: "string" },
              content: { type: "string" }
            },
            required: ["filename", "content"]
          }
        }]
      };
    }

    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      if (name === "write_file") {
        this.files[args.filename] = args.content;
        return { content: [{ type: "text", text: \`Successfully wrote \${args.content.length} chars to \${args.filename}\` }] };
      }
    }
    throw new Error(\`Method \${request.method} not found on \${this.name}\`);
  }
}

// --- 2. MCP CLIENT ADAPTER ---
// Handles the JSON-RPC connection to a specific server
class MCPClient {
  constructor(server) {
    this.server = server;
    this.serverName = server.name;
  }

  // Visualizes the protocol messages as Spans in the graph
  async send(method, params = {}, parentId = null) {
    const spanName = \`RPC: \${method}\`; // e.g. "RPC: tools/list"
    
    // We create a span for the network call itself
    const span = tracer.startSpan(spanName, { server: this.serverName, params }, parentId);
    
    try {
      console.debug(\`[Client -> \${this.serverName}] \${method}\`);
      console.debug(\`   >> Params: \${JSON.stringify(params)}\`);
      
      // Simulate network delay for realism
      await new Promise(r => setTimeout(r, 100)); 
      
      const response = await this.server.handleMessage({ 
        jsonrpc: "2.0", 
        id: crypto.randomUUID(), 
        method, 
        params 
      });
      
      console.debug(\`[\${this.serverName} -> Client] Response received\`);
      console.debug(\`   << Result: \${JSON.stringify(response)}\`);

      tracer.endSpan(span.id, response);
      return response;
    } catch(e) {
      console.error(\`RPC Error (\${this.serverName}):\`, e);
      throw e;
    }
  }

  async connect(parentId) {
    return this.send("initialize", {}, parentId);
  }
}

// --- HELPER: CONTEXT FORMATTING ---
// Prevents "Prompt Leakage" by summarizing tools into a lightweight signature
function formatToolsForContext(tools) {
  return tools.map(t => {
    const args = Object.keys(t.inputSchema.properties || {}).join(", ");
    return \`- \${t.name}(\${args}): \${t.description}\`;
  }).join("\\n");
}

// --- STEP DEFINITIONS ---

// Step 1: Universal Discovery
// Connects to ALL servers and builds a unified Tool Registry
async function discoverCapabilities(clients, parentId) {
  const span = tracer.startSpan('UniversalDiscovery', {}, parentId);
  try {
    console.log("[Universal Client] Starting Discovery Phase...");
    
    const registry = [];
    const clientMap = new Map(); // Maps tool_name -> client_instance

    for (const client of clients) {
      // 1. Handshake (Connect)
      await client.connect(span.id);
      
      // 2. List Tools
      const response = await client.send("tools/list", {}, span.id);
      
      // 3. Register
      for (const tool of response.tools) {
        registry.push(tool);
        clientMap.set(tool.name, client); // Remember which server owns this tool
      }
    }

    console.log(\`[Discovery] Found \${registry.length} tools across \${clients.length} servers.\`);
    tracer.endSpan(span.id, registry);
    return { registry, clientMap, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Plan
// The Agent sees the unified capabilities and forms a multi-step plan
async function formulatePlan(goal, tools, parentId) {
  const span = tracer.startSpan('Planner', { goal }, parentId);
  try {
    console.log("[Agent] Formulating plan based on discovered tools...");

    const toolContext = formatToolsForContext(tools);
    
    const prompt = \`
    GOAL: "\${goal}"

    AVAILABLE TOOLS (MCP):
    \${toolContext}

    Create a logical execution plan.
    Return a JSON ARRAY of steps.
    Example: [{"tool": "tool_name", "args": {...}}, ...]
    \`;

    let response = await callGemini(prompt, 0);
    // Sanitize
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    const plan = JSON.parse(response);
    
    console.log(\`[Planner] Generated \${plan.length} steps.\`);
    tracer.endSpan(span.id, plan);
    return { result: plan, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Execution Loop
// Iterates the plan and routes calls to the correct server
async function executePlan(plan, clientMap, parentId) {
  let lastSpanId = parentId;
  const results = [];

  for (const step of plan) {
    const client = clientMap.get(step.tool);
    if (!client) throw new Error(\`No server found for tool: \${step.tool}\`);

    console.log(\`[Agent] Executing \${step.tool} on \${client.serverName}...\`);

    // The execute step wrapper
    const stepSpan = tracer.startSpan(\`exec_\${step.tool}\`, step, lastSpanId);
    
    // The actual RPC call (nested span)
    const response = await client.send("tools/call", {
      name: step.tool,
      arguments: step.args
    }, stepSpan.id);

    const output = response.content[0].text;
    console.log(\`[Agent] Result: \${output}\`);
    
    results.push(output);
    tracer.endSpan(stepSpan.id, output);
    
    lastSpanId = stepSpan.id;
  }
  
  return { result: results, spanId: lastSpanId };
}

// --- EXECUTION FLOW ---
console.log("Starting Multi-Server MCP Agent...");

const inputGoal = "Find all 'admin' users and save the report to 'admins_report.txt'.";
console.info("--- INPUT (GOAL) ---");
console.info(inputGoal);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Initialize Infrastructure (Multiple Servers)
  const dbServer = new MockDatabaseServer();
  const fsServer = new MockFileSystemServer();
  
  const clients = [
    new MCPClient(dbServer),
    new MCPClient(fsServer)
  ];

  // 2. Discover (The Universal Client Pattern)
  const discovery = await discoverCapabilities(clients, null);
  
  // 3. Plan
  const planStep = await formulatePlan(inputGoal, discovery.registry, discovery.spanId);
  
  // 4. Execute
  const execResult = await executePlan(planStep.result, discovery.clientMap, planStep.spanId);

  console.info("--- WORKFLOW COMPLETE ---");
  console.info("Check Sequence Diagram for Protocol Details.");

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
