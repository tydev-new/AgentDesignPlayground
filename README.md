Agent Design Playground
From Static Blueprints to Live Code.

The Agent Design Playground is a browser-based environment designed to visualize, debug, and experiment with AI Agent design patterns.

Inspired by Antonio Gulli's book Agentic Design Patterns, this tool transforms abstract concepts—like Reflection, Tool Use, and Multi-Agent Orchestration—into interactive, runnable experiments.

🚀 Try the Live Demo https://agent-design-playground-268629993676.us-west1.run.app

💡 Why this exists
Reading about "Self-Reflecting" agents is abstract. Seeing an agent audit its own thought process, flag a hallucination, and self-correct in real-time is where the real learning happens.

Most agent tutorials are "read-only" or require complex local Python environments. This project solves that by providing:

Zero Setup: Runs entirely in the browser using vanilla JavaScript.

Visual Debugging: Automatically generates DAGs and Sequence Diagrams to visualize the agent's "thought process."

Live Editing: Modify the prompt logic and guardrails on the fly to see how the agent adapts.

✨ Key Features
Pattern Library: Pre-loaded implementations of core agent patterns (ReAct, Chain-of-Thought, RAG, etc.).

Trace Visualization: See the execution flow, intermediate outputs, and JSON-RPC handshakes (for MCP).

No Frameworks: Built with dependency-free JavaScript. No langchain, no crewai—just raw logic so you can understand the underlying mechanics.

Local Persistence: Save your custom pattern configurations to local storage.

BYO Key: Securely works with your own API Keys (Gemini/OpenAI). Keys are stored only in your browser's memory/local storage and are never sent to a backend server.

📚 Supported Patterns
This repository includes implementations of patterns discussed in Agentic Design Patterns:

Chapter 4: Reflection: Agents that critique their own "first draft" to catch logic errors.

Chapter 10: Model Context Protocol (MCP): Simulates a "Universal Client" connecting to tools (Database/Filesystem).

Chapter 19: Evaluation: A/B testing where a "Judge" agent evaluates a Baseline vs. Candidate model.

Core Patterns:

Chain-of-Thought (CoT)

ReAct (Reasoning + Acting)

RAG (Retrieval Augmented Generation)

🛠️ Running Locally
Because this project uses vanilla JavaScript, you don't need a complex build step.

Prerequisites
A modern web browser.

A simple HTTP server (to avoid CORS issues with local files).

Installation
Clone the repository:

Bash

git clone https://github.com/YOUR_USERNAME/agent-design-playground.git
cd agent-design-playground
Start a local server:

If you have Python installed:

Bash

python3 -m http.server 8000
Or using Node.js http-server:

Bash

npx http-server .
Open in Browser: Navigate to http://localhost:8000

🤝 Contributing
Contributions are welcome! I am actively adding new features and patterns.

Fork the Project

Create your Feature Branch (git checkout -b feature/NewPattern)

Commit your Changes (git commit -m 'Add new Agency pattern')

Push to the Branch (git push origin feature/NewPattern)

Open a Pull Request

Acknowledgements
Antonio Gulli: For writing Agentic Design Patterns, the blueprint for this project.

Mermaid.js: Used for generating the live architecture diagrams.

📄 License
Distributed under the MIT License. See LICENSE for more information.

Built by Yong Tian. Let's build smarter agents.
