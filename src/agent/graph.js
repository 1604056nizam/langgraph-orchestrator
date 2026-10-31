import { StateGraph, START, END } from "@langchain/langgraph";
import { checkpointer } from "../db/checkpointer.js";
import { GraphState } from "./state.js";
import { routeNode, directNode, webNode, docsNode, evaluatorNode, rewriterNode, generatorNode } from "./nodes.js";
import { routeDecisionEdge, cragDecisionEdge } from "./edges.js";

const workFlow = new StateGraph(GraphState)
    .addNode("router", routeNode)
    .addNode("direct", directNode)
    .addNode("web_search", webNode)
    .addNode("vectorstore", docsNode)
    .addNode("evaluator", evaluatorNode)
    .addNode("rewriter", rewriterNode)
    .addNode("generator", generatorNode)

    .addEdge(START, "router")
    .addConditionalEdges("router", routeDecisionEdge, {
        direct: "direct",
        web_search: "web_search",
        vectorstore: "vectorstore"
    })
    .addEdge("direct", END)
    .addEdge("web_search", "generator")
    .addEdge("vectorstore", "evaluator")
    .addConditionalEdges("evaluator", cragDecisionEdge, {
        generate: "generator",
        rewrite: "rewriter"
    })
    .addEdge("rewriter", "router")
    .addEdge("generator", END)

export const agent = workFlow.compile({ checkpointer });