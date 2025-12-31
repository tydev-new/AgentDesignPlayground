
# 01_Master_Design_Doc: Agent Design Playground

## 1. Product Requirements Document (PRD)

### 1.1 Vision
A browser-based, high-fidelity IDE for learning and prototyping **Agentic Design Patterns**. It removes the friction of local setup (Node.js, package managers) by executing real production-grade code directly in the browser.

### 1.2 Target Audience
- AI Engineers prototyping complex graph workflows.
- Developers learning the "Agentic Design Patterns" series.
- Educators demonstrating agent behaviors in real-time.

### 1.3 Core Features
- **Live Code Execution**: Direct execution of ESM-compatible code using browser-native dynamic imports.
- **Dynamic Trace Visualization**: Renders the *actual* execution path (DAG) using a runtime tracer, with static analysis as a fallback.
- **Multi-Level Terminal**: A filterable output panel that distinguishes between "Business Logic" (Info) and "System Mechanics" (Debug).
- **Symbol Navigation**: A jump-to menu for finding Nodes, Inputs, and Graph definitions in large files.
- **Pattern Library**: Pre-built, executable examples of Prompt Chaining, Routing, Parallelization, and Cycles.

---

## 2. UI / UX Design

### 2.1 Visual Language
- **Theme**: Slate/Dark mode (Slate-900 to Slate-950).
- **Accents**: Indigo-600 for primary actions, Emerald for success/active states, Red for errors/stop.
- **Typography**: 
  - UI: `Inter` (sans-serif)
  - Code/Terminal: `Fira Code` (monospace)

### 2.2 Layout
- **Header**: Global controls. Contains Example Selector, Run/Stop buttons, and Branding.
- **Main View**: A 50/50 horizontal split.
  - **Left (Source)**: Code Editor with a sub-toggle for "Editor" vs. "Diagram" views.
  - **Right (Sink)**: Terminal-style Output Panel.
- **Footer**: System status bar showing execution environment and library versions.

---

## 3. Engineering Design

### 3.1 Technical Stack
- **Frontend**: React 18 (via ESM imports).
- **Code Execution**: `URL.createObjectURL(new Blob(...))` + Dynamic `import()`.
- **LLM Integration**: `@google/genai` (Gemini 2.5/3 Series).
- **Graphing**: `mermaid.js`.
- **Styling**: Tailwind CSS.

### 3.2 Execution Engine (`services/geminiService.ts`)
The application executes user code as a real ES Module. 
1. **Console Interception**: Patches `window.console` methods before execution to capture logs.
2. **Key Injection**: Dynamically populates `process.env.API_KEY` within the virtual module context.
3. **Sandbox**: Uses a Blob-based dynamic import to isolate execution from the main application loop.
4. **Graph Hook**: Injects `window.__setGraphDefinition` to allow the executing code to report its own topology back to the UI.

### 3.3 Topology Analysis & Observability
The application employs a **Hybrid Observability Strategy**:
1.  **Dynamic Runtime Tracing (Primary)**: The executing code runs a lightweight `SimpleTracer` class. As nodes execute, they push spans to an internal array. At completion, the code calls `tracer.publishGraph()`, which sends the specific execution path (Mermaid DAG) back to the UI.
2.  **Static Regex Parser (Fallback)**: If code hasn't run yet, `services/mermaidParser.ts` attempts to infer structure using Regex to provide an immediate visual cue.

### 3.4 State & Logging
- **ExecutionStatus**: `IDLE` | `RUNNING` | `SUCCESS` | `ERROR`.
- **Log Levels**: 
  - `info`: Maps to `console.info`. Visible in "Show input & output". STRICT Input/Output only.
  - `verbose`: Maps to `console.log`. Visible in "Show all logs". General flow.
  - `system`: Maps to `console.debug`. Visible in "Show all logs". Trace details.

---

## 4. Architectural Patterns & Guidelines

### 4.1 Agent Generation Protocol
All agent examples must strictly adhere to **`AGENT_GENERATION_PROTOCOL.md`**.
This ensures compatibility with the runtime tracer and prevents hallucination of external libraries.

**Key Protocol Rules:**
- **No External Libraries**: Logic must be Vanilla JS/TS (Native Fetch).
- **Mandatory Boilerplate**: Every file must include the `SimpleTracer` class definition.
- **Step Architecture**: Steps must accept `(input, parentSpanId)` and return `{ result, spanId }` to link the DAG edges dynamically.

### 4.2 Logging Standards
Every node should identify itself via `console.debug` (System) and report business logic via `console.log` (Verbose). Critical I/O must use `console.info`.
