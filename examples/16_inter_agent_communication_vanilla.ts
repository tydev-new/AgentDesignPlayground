
export const CODE_INTER_AGENT_COMMUNICATION_VANILLA = `/**
 * CHAPTER 15: INTER-AGENT COMMUNICATION (A2A) (VANILLA JS)
 *
 * This pattern establishes a standardized protocol (like a "handshake" or shared message bus) for distinct agents to exchange information and request services from one another. It enables complex, distributed systems where agents can "hire" other agents to perform sub-tasks without needing a central orchestrator to manage every message.
 *
 * 1. AGENT A: "Personal Assistant" (The Orchestrator/Client)
 * - Role: Represents the User.
 * - Responsibility: Discovers capabilities ("Who can help?") and plans workflows.
 * - Logic: Does NOT know how to access the DB. It only knows how to ask.
 *
 * 2. AGENT B: "Calendar Service" (The Specialist/Server)
 * - Role: Owns the Domain Data (The Schedule).
 * - Responsibility: Exposes specific "Skills" (API Functions) to other agents.
 * - Logic: Executes requests only if they match its "Agent Card" capabilities.
 *
 * 3. THE PROTOCOL: Message Passing
 * - Rule: Agents never call each other's code directly.
 * - Mechanism: They exchange JSON payloads via a shared bus (BroadcastChannel).
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

// --- LOCAL MESSAGE BUS (Simulates BroadcastChannel) ---
// We use a local bus to ensure isolation between playground runs.
class LocalMessageBus {
  constructor(name) {
    this.name = name;
    this.listeners = [];
  }

  // Subscribe to messages
  addEventListener(handler) {
    this.listeners.push(handler);
  }

  // Publish message to all subscribers (Simulates network broadcast)
  postMessage(data) {
    // Add small delay to simulate network latency
    setTimeout(() => {
      this.listeners.forEach(handler => handler({ data }));
    }, 50);
  }
}
const network = new LocalMessageBus('a2a_calendar_demo');


// --- 1. THE CALENDAR AGENT (The Specialist) ---
class CalendarAgent {
  constructor() {
    this.identity = {
      // THE "AGENT CARD" (Key Concept from Chapter 15)
      name: "Corporate Calendar Agent",
      version: "1.2.0",
      id: "agent_calendar_core",
      description: "Manages team schedules and room bookings.",
      skills: ["check_availability", "book_event"]
    };
    
    // Internal "Database" of busy slots
    this.schedule = ["09:00", "10:00", "14:00"]; 
    
    // Listen to network
    network.addEventListener((e) => this.handleMessage(e.data));
    console.log(\`[CalendarAgent] Online. Skills: \${this.identity.skills.join(", ")}\`);
  }

  async handleMessage(msg) {
    // Prevent self-reply (echo)
    if (msg.sender === this.identity.id) return;

    // A. DISCOVERY HANDSHAKE
    if (msg.type === "DISCOVERY_REQUEST") {
      // We use an LLM to "Intelligently" decide if we can help
      // This is the "Semantic Discovery" phase.
      const shouldHelp = await this.evaluateCapability(msg.query, msg.traceId);
      
      if (shouldHelp) {
        console.log(\`[CalendarAgent] 🙋‍♂️ I can help with "\${msg.query}"\`);
        this.reply(msg.sender, "DISCOVERY_RESPONSE", { card: this.identity }, msg.traceId);
      }
    }

    // B. TASK EXECUTION
    if (msg.type === "TASK_REQUEST" && msg.target === this.identity.id) {
      // Start a span for the actual work, linked to the requester's trace
      const span = tracer.startSpan('Calendar_Execute', msg.payload, msg.traceId);
      console.log(\`[CalendarAgent] 🗓️ Processing Task: \${msg.payload.action}\`);
      
      const { action, time } = msg.payload;
      let response = {};

      // Simulate Processing
      await new Promise(r => setTimeout(r, 600));

      if (action === "check_availability") {
        const isBusy = this.schedule.includes(time);
        response = { status: "OK", available: !isBusy, time };
        console.log(\`[CalendarAgent] Check \${time}: \${isBusy ? 'BUSY' : 'FREE'}\`);
      } 
      else if (action === "book_event") {
        this.schedule.push(time);
        response = { status: "OK", confirmed: true, eventId: \`evt_\${Math.floor(Math.random() * 1000)}\` };
        console.log(\`[CalendarAgent] Booked \${time}. New Schedule: [\${this.schedule.join(', ')}]\`);
      }

      tracer.endSpan(span.id, response);
      this.reply(msg.sender, "TASK_RESPONSE", { correlationId: msg.id, result: response }, span.id);
    }
  }

  async evaluateCapability(query, parentId) {
    // Semantic Check: Does this query relate to my skills?
    const span = tracer.startSpan('Calendar_EvalCapability', { query }, parentId);
    try {
        const prompt = \`
        My Description: \${this.identity.description}
        My Skills: \${JSON.stringify(this.identity.skills)}
        
        Incoming Query: "\${query}"
        
        Can I handle this query? Answer YES or NO only.
        \`;
        const res = await callGemini(prompt, 0);
        const match = res.trim().toUpperCase().includes("YES");
        tracer.endSpan(span.id, match);
        return match;
    } catch (e) { return false; }
  }

  reply(target, type, data, traceId) {
    network.postMessage({ 
      type, 
      target, 
      sender: this.identity.id, 
      traceId, // Pass traceId to maintain the distributed trace graph
      ...data 
    });
  }
}

// --- 2. THE ASSISTANT (The Orchestrator) ---
class PersonalAssistant {
  constructor() {
    this.id = "agent_assistant_01";
    this.pending = new Map(); // Stores callbacks for pending requests
    
    network.addEventListener((e) => this.handleIncoming(e.data));
  }

  // 1. DISCOVERY: Find an agent capable of X
  async findAgent(intent, parentId) {
    const span = tracer.startSpan('Assistant_FindAgent', { intent }, parentId);
    console.log(\`[Assistant] 📢 Broadcasting: "Who can \${intent}?"...\`);
    
    // Broadcast
    network.postMessage({ 
        type: "DISCOVERY_REQUEST", 
        sender: this.id, 
        query: intent,
        traceId: span.id
    });
    
    // Wait for the first valid Agent Card
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
          console.warn("[Assistant] No agent replied in time.");
          resolve(null);
      }, 5000);

      // We register a one-time listener for the reply
      // Note: In a real system, we'd add/remove this listener cleanly.
      this.discoveryResolver = (card) => {
          clearTimeout(timeout);
          tracer.endSpan(span.id, card);
          resolve(card);
      };
    });
  }

  // 2. EXECUTE: Send specific payload to specific Agent
  async execute(agentId, taskPayload, parentId) {
    const span = tracer.startSpan('Assistant_Execute', { agentId, task: taskPayload.action }, parentId);
    const taskId = crypto.randomUUID();
    
    console.log(\`[Assistant] 🚀 Delegating task to \${agentId}...\`);
    
    network.postMessage({ 
        type: "TASK_REQUEST", 
        id: taskId, 
        sender: this.id, 
        target: agentId, 
        payload: taskPayload,
        traceId: span.id
    });

    // Wait for specific correlation ID
    return new Promise(resolve => {
        this.pending.set(taskId, (result) => {
            tracer.endSpan(span.id, result);
            resolve(result);
        });
    });
  }

  handleIncoming(msg) {
    // Handle Discovery Responses
    if (msg.type === "DISCOVERY_RESPONSE" && msg.target === this.id) {
        if (this.discoveryResolver) {
            this.discoveryResolver(msg.card);
            this.discoveryResolver = null;
        }
    }

    // Handle Task Responses
    if (msg.type === "TASK_RESPONSE" && msg.target === this.id) {
        if (this.pending.has(msg.correlationId)) {
            const resolver = this.pending.get(msg.correlationId);
            resolver(msg.result);
            this.pending.delete(msg.correlationId);
        }
    }
  }
}

// --- DEMO EXECUTION ---
console.log("Starting A2A Calendar Scenario...");

async function runBookScenario() {
  try {
    if (!API_KEY) throw new Error("API_KEY missing.");
    
    const rootSpan = tracer.startSpan('Scenario_Start');

    // 1. Init Agents
    const calendar = new CalendarAgent();
    const assistant = new PersonalAssistant();
    
    // Allow agents to "boot up"
    await new Promise(r => setTimeout(r, 100));

    // 2. Discover
    // User wants to schedule a meeting. Assistant asks "Who can help?"
    const intent = "schedule a meeting";
    const agentCard = await assistant.findAgent(intent, rootSpan.id);

    if (!agentCard) {
        console.error("No agent found.");
        tracer.endSpan(rootSpan.id, "Failed");
        tracer.publishGraph();
        return;
    }

    console.log(\`[Assistant] Found Specialist: \${agentCard.name} (v\${agentCard.version})\`);

    // 3. Logic: Check Availability -> Book
    // We try to book a slot. 11:00 is not in the busy list (09, 10, 14).
    const targetTime = "11:00";
    
    const slotCheck = await assistant.execute(
        agentCard.id, 
        { action: "check_availability", time: targetTime },
        rootSpan.id
    );
    
    if (slotCheck.available) {
        console.log(\`[Assistant] Slot \${targetTime} is free. Booking now...\`);
        const booking = await assistant.execute(
            agentCard.id, 
            { action: "book_event", time: targetTime },
            rootSpan.id
        );
        console.log(\`[Final Output] ✅ Meeting Confirmed! ID: \${booking.eventId}\`);
    } else {
        console.log(\`[Final Output] ❌ Slot \${targetTime} is busy.\`);
    }

    tracer.endSpan(rootSpan.id, "Success");
    tracer.publishGraph();
    
  } catch (e) {
    console.error("Scenario failed:", e);
  }
}

// Start (Use Top-Level Await to ensure console stays active)
await runBookScenario();
`;
