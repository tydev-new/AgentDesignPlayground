
export const CODE_RAG_VANILLA = `/**
 * CHAPTER 14: ADVANCED RAG (VANILLA JS)
 *
 * This pattern dynamically fetches relevant information from external documents or databases to ground the agent's responses in factual data. By retrieving only the necessary context at runtime, it allows the model to answer questions about private or up-to-date data that was not present in its training set.
 * 
 * Pattern: "Query Expansion & Semantic Bridging"
 * Instead of blindly searching for the user's raw text, this agent:
 * 1. TRANSFORM: Uses an LLM to rewrite the user's query into "Database Keywords".
 *    (This simulates Vector Search by bridging "WFH" -> "Remote Work Policy").
 * 2. RETRIEVE: Searches using the optimized keywords (Token-based weighted search).
 * 3. SYNTHESIZE: Generates an answer with strict [Source: ID] citations.
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

// --- KNOWLEDGE BASE (Simulating Semantic Search) ---
class SmartKnowledgeBase {
  constructor() {
    this.documents = [
      {
        id: "Policy-001",
        title: "Remote Work & Telecommuting",
        // Hidden 'embedding-like' tags that the LLM will guess
        tags: ["wfh", "home office", "remote", "attendance", "core hours"], 
        content: "Employees may work remotely 3 days/week. Core hours are 10am-3pm."
      },
      {
        id: "Policy-002",
        title: "Expense & Travel",
        tags: ["food", "travel", "flight", "reimbursement", "per diem", "money", "lunch", "dinner"],
        content: "Meal allowance is $50/day. Receipts required for expenses over $25."
      },
      {
        id: "Policy-003",
        title: "IT Security",
        tags: ["password", "access", "2fa", "login", "credentials"],
        content: "Passwords expire every 90 days. 2FA is mandatory."
      }
    ];
  }

  // Improved Search: Tokenization + Weighted Scoring
  async search(llmPhrases) {
    console.log(\`[Database] Raw LLM Phrases: \${JSON.stringify(llmPhrases)}\`);
    await new Promise(r => setTimeout(r, 400)); // Simulate DB latency

    // 1. TOKENIZE: Break phrases into individual words and remove duplicates
    // "travel meal reimbursement" -> ["travel", "meal", "reimbursement"]
    const searchTokens = new Set(
      llmPhrases
        .flatMap(phrase => phrase.toLowerCase().split(/\\s+/)) // Split by spaces
        .filter(word => word.length > 2) // Ignore "is", "at", "to"
    );
    
    console.log(\`[Database] Optimized Search Tokens: \${JSON.stringify(Array.from(searchTokens))}\`);

    const results = this.documents.map(doc => {
      let score = 0;
      const matches = []; // For debug logging
      
      // Combine all doc text into one searchable blob
      const docText = (doc.title + " " + doc.content + " " + doc.tags.join(" ")).toLowerCase();
      const titleText = doc.title.toLowerCase();
      
      // 2. SCORING: Check for each WORD, not the whole phrase
      searchTokens.forEach(token => {
        if (docText.includes(token)) {
          let points = 1;
          // Bonus: Weight title matches higher!
          if (titleText.includes(token)) points += 2; 
          
          score += points;
          matches.push(\`\${token} (+\${points})\`);
        }
      });

      // Verbose logging for system trace
      if (score > 0) {
        console.debug(\`[Database] Hit: "\${doc.title}" (ID: \${doc.id})\`);
        console.debug(\`    > Matches: [\${matches.join(", ")}]\`);
        console.debug(\`    > Total Score: \${score}\`);
      }

      return { ...doc, score };
    });

    // Return documents with >0 matches, sorted by score
    return results.filter(d => d.score > 0).sort((a, b) => b.score - a.score);
  }
}
const db = new SmartKnowledgeBase();

// --- STEP DEFINITIONS ---

// Step 1: Query Transformation (The "Semantic Bridge")
async function transformQuery(userQuery, parentId) {
  const span = tracer.startSpan('transformQuery', { userQuery }, parentId);
  try {
    console.log("[Agent] 🧠 Translating user intent to database keywords...");
    
    // We ask the LLM to hallucinate the most likely keywords found in a corporate policy DB
    const prompt = \`
    User Query: "\${userQuery}"
    
    Imagine you are searching a Corporate Handbook database.
    Generate 5 specific search keywords or phrases that would help answer this query.
    Prefer single words or short 2-word compound nouns.
    Avoid full sentences.
    
    Return ONLY a JSON array of strings.
    \`;

    let response = await callGemini(prompt);
    // Sanitize JSON
    response = response.replace(/\\\`\\\`\\\`json/g, "").replace(/\\\`\\\`\\\`/g, "").trim();
    
    let keywords = [];
    try {
      keywords = JSON.parse(response);
    } catch (e) {
      console.warn("JSON parse failed, using fallback keywords");
      keywords = userQuery.split(" ");
    }

    console.log(\`[Agent] Keywords generated: \${JSON.stringify(keywords)}\`);
    tracer.endSpan(span.id, keywords);
    return { result: keywords, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 2: Retrieve
async function retrieveContext(keywords, parentId) {
  const span = tracer.startSpan('retrieveContext', { keywords }, parentId);
  try {
    const docs = await db.search(keywords);
    
    // Format for injection
    const contextStr = docs.length > 0 
      ? docs.map(d => \`[ID: \${d.id}] Title: \${d.title}\\nContent: \${d.content}\`).join("\\n\\n")
      : "NO DOCUMENTS FOUND.";

    console.log(\`[Retrieval] Found \${docs.length} relevant documents.\`);
    if (docs.length > 0) {
      console.log(\`[Retrieval] Top Match: "\${docs[0].title}" (Score: \${docs[0].score})\`);
    }

    tracer.endSpan(span.id, contextStr);
    return { result: contextStr, spanId: span.id };
  } catch(e) { throw e; }
}

// Step 3: Generate with Citations
async function generateAnswer(userQuery, context, parentId) {
  const span = tracer.startSpan('generateAnswer', { userQuery, contextLength: context.length }, parentId);
  try {
    console.log("[Generator] Synthesizing answer with grounded context...");
    
    const prompt = \`
    Context from Knowledge Base:
    \${context}

    User Question: \${userQuery}

    Instructions:
    1. Answer the question using ONLY the context.
    2. You MUST cite your sources using the format [Source: Policy-XXX].
    3. If the answer is not in the context, state that clearly.
    \`;

    const response = await callGemini(prompt, 0.5);
    tracer.endSpan(span.id, response);
    return { result: response, spanId: span.id };
  } catch(e) { throw e; }
}

// --- EXECUTION FLOW ---
console.log("Starting Advanced RAG Agent (Query Transform -> Retrieve -> Cite)...");

const inputQuery = "Does the company pay for my lunch when I travel?";
console.info("--- USER QUERY ---");
console.info(inputQuery);

try {
  if (!API_KEY) throw new Error("API_KEY missing.");

  // 1. Transform (The Semantic Bridge)
  const transformStep = await transformQuery(inputQuery, null);
  
  // 2. Retrieve
  const retrievalStep = await retrieveContext(transformStep.result, transformStep.spanId);
  
  // 3. Generate
  const finalStep = await generateAnswer(inputQuery, retrievalStep.result, retrievalStep.spanId);
  
  console.info("\\n--- FINAL ANSWER ---");
  console.info(finalStep.result);

  tracer.publishGraph();

} catch (e) {
  console.error("Execution failed:", e);
}
`;
