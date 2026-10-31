import { StateGraph, START, END } from "@langchain/langgraph";
import { checkpointer } from "../db/checkpointer.js";
import { GraphState } from "./state.js";
import { routeNode, executeCapabilityNode, evaluatorNode, rewriterNode, generatorNode, contextualizeNode, summarizerNode } from "./nodes.js";
import { postCapabilityEdge, cragDecisionEdge, shouldSummarizeEdge } from "./edges.js";

const workFlow = new StateGraph(GraphState)
    .addNode("router", routeNode)
    .addNode("execute_capability", executeCapabilityNode)
    .addNode("evaluator", evaluatorNode)
    .addNode("rewriter", rewriterNode)
    .addNode("generator", generatorNode)
    .addNode("contextualizer", contextualizeNode)
    .addNode("summarizer", summarizerNode)

    .addEdge(START, "contextualizer")
    .addEdge("contextualizer", "router")
    .addEdge("router", "execute_capability")
    .addConditionalEdges("execute_capability", postCapabilityEdge, {
        summarize: "summarizer",
        end: END,
        evaluate: "evaluator",
        generate: "generator"
    })
    .addConditionalEdges("evaluator", cragDecisionEdge, {
        generate: "generator",
        rewrite: "rewriter"
    })
    .addEdge("rewriter", "router")
    .addConditionalEdges("generator", shouldSummarizeEdge, {
        summarize: "summarizer",
        end: END
    })
    .addEdge("summarizer", END)

export const agent = workFlow.compile({ checkpointer });