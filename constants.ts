
import { CodeSnippet } from "./types";
import { CODE_PROMPT_CHAINING_VANILLA } from "./examples/01_5_prompt_chaining_vanilla";
import { CODE_ROUTING_VANILLA } from "./examples/02_routing_vanilla";
import { CODE_PARALLELIZATION_VANILLA } from "./examples/03_parallelization_vanilla";
import { CODE_REFLECTION_VANILLA } from "./examples/04_reflection_vanilla";
import { CODE_TOOL_USE_VANILLA } from "./examples/05_tool_use_vanilla";
import { CODE_TOOL_USE_API } from "./examples/06_tool_use_api";
import { CODE_PLANNING_VANILLA } from "./examples/07_planning_vanilla";
import { CODE_MULTI_AGENT_VANILLA } from "./examples/08_multi_agent_vanilla";
import { CODE_MEMORY_VANILLA } from "./examples/09_memory_vanilla";
import { CODE_LEARNING_VANILLA } from "./examples/10_learning_vanilla";
import { CODE_MCP_VANILLA } from "./examples/13_mcp_vanilla";
import { CODE_GOAL_SETTING_VANILLA } from "./examples/11_goal_setting_vanilla";
import { CODE_EXCEPTION_HANDLING_VANILLA } from "./examples/12_exception_handling_vanilla";
import { CODE_HUMAN_IN_THE_LOOP_VANILLA } from "./examples/14_human_in_the_loop_vanilla";
import { CODE_RAG_VANILLA } from "./examples/15_rag_vanilla";
import { CODE_INTER_AGENT_COMMUNICATION_VANILLA } from "./examples/16_inter_agent_communication_vanilla";
import { CODE_RESOURCE_OPTIMIZATION_VANILLA } from "./examples/17_resource_optimization_vanilla";
import { CODE_REASONING_TECHNIQUES_VANILLA } from "./examples/18_reasoning_techniques_vanilla";
import { CODE_GUARDRAILS_VANILLA } from "./examples/19_guardrails_vanilla";
import { CODE_EVALUATION_VANILLA } from "./examples/20_evaluation_vanilla";
import { CODE_PRIORITIZATION_VANILLA } from "./examples/21_prioritization_vanilla";
import { CODE_EXPLORATION_VANILLA } from "./examples/22_exploration_vanilla";

const CODE_EMPTY_TEMPLATE = `// Filename: my_agent.js

// Write your agent code here...
`;

export const EXAMPLES: CodeSnippet[] = [
  {
    name: "Ch.1 Prompt Chaining",
    code: CODE_PROMPT_CHAINING_VANILLA
  },
  {
    name: "Ch.2 Routing",
    code: CODE_ROUTING_VANILLA
  },
  {
    name: "Ch.3 Parallelization",
    code: CODE_PARALLELIZATION_VANILLA
  },
  {
    name: "Ch.4 Reflection",
    code: CODE_REFLECTION_VANILLA
  },
  {
    name: "Ch.5 Tool Use (Raw JSON)",
    code: CODE_TOOL_USE_VANILLA
  },
  {
    name: "Ch.5 Tool Use (Native API)",
    code: CODE_TOOL_USE_API
  },
  {
    name: "Ch.6 Planning",
    code: CODE_PLANNING_VANILLA
  },
  {
    name: "Ch.7 Multi-Agent",
    code: CODE_MULTI_AGENT_VANILLA
  },
  {
    name: "Ch.8 Memory (Hybrid)",
    code: CODE_MEMORY_VANILLA
  },
  {
    name: "Ch.9 Learning & Adaptation",
    code: CODE_LEARNING_VANILLA
  },
  {
    name: "Ch.10 Model Context Protocol",
    code: CODE_MCP_VANILLA
  },
  {
    name: "Ch.11 Goal Setting",
    code: CODE_GOAL_SETTING_VANILLA
  },
  {
    name: "Ch.12 Exception Handling",
    code: CODE_EXCEPTION_HANDLING_VANILLA
  },
  {
    name: "Ch.13 Human-in-the-Loop",
    code: CODE_HUMAN_IN_THE_LOOP_VANILLA
  },
  {
    name: "Ch.14 Retrieval Augmented Generation",
    code: CODE_RAG_VANILLA
  },
  {
    name: "Ch.15 Inter-Agent Communication",
    code: CODE_INTER_AGENT_COMMUNICATION_VANILLA
  },
  {
    name: "Ch.16 Resource-Aware Optimization",
    code: CODE_RESOURCE_OPTIMIZATION_VANILLA
  },
  {
    name: "Ch.17 Reasoning Techniques",
    code: CODE_REASONING_TECHNIQUES_VANILLA
  },
  {
    name: "Ch.18 Guardrails",
    code: CODE_GUARDRAILS_VANILLA
  },
  {
    name: "Ch.19 Evaluation",
    code: CODE_EVALUATION_VANILLA
  },
  {
    name: "Ch.20 Prioritization",
    code: CODE_PRIORITIZATION_VANILLA
  },
  {
    name: "Ch.21 Exploration",
    code: CODE_EXPLORATION_VANILLA
  },
  {
    name: "Empty Template",
    code: CODE_EMPTY_TEMPLATE
  }
];
