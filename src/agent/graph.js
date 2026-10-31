import { StateGraph, START, END } from "@langchain/langgraph";
import { checkpointer } from "../db/checkpointer.js";
import { GraphState } from "./state.js";
import { routeNode, executeCapabilityNode, evaluatorNode, rewriterNode, generatorNode } from "./nodes.js";
import { postCapabilityEdge, cragDecisionEdge } from "./edges.js";

const workFlow = new StateGraph(GraphState)
    .addNode("router", routeNode)
    .addNode("execute_capability", executeCapabilityNode)
    .addNode("evaluator", evaluatorNode)
    .addNode("rewriter", rewriterNode)
    .addNode("generator", generatorNode)

    .addEdge(START, "router")
    .addEdge("router", "execute_capability")
    .addConditionalEdges("execute_capability", postCapabilityEdge, {
        end: END,
        evaluate: "evaluator",
        generate: "generator"
    })
    .addConditionalEdges("evaluator", cragDecisionEdge, {
        generate: "generator",
        rewrite: "rewriter"
    })
    .addEdge("rewriter", "router")
    .addEdge("generator", END)

export const agent = workFlow.compile({ checkpointer });