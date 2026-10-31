import dotenv from "dotenv";
import path from "path";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { docsTool } from "../src/tools/docsTool.js";
import { webSearchTool } from "../src/tools/webSearchTool.js";
import {
    BaseCapability,
    DirectCapability,
    WebSearchCapability,
    VectorDocsCapability,
    CapabilityRegistry,
    AdaptiveRouter
} from "./test-adaptive-capabilities.js";
import { CRAGEvaluator, QueryRewriter, RetryController } from "./test-crag-evaluator.js";


dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") });

const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0.2
});

const registry = new CapabilityRegistry();
registry.register(new DirectCapability());
registry.register(new WebSearchCapability());
registry.register(new VectorDocsCapability());

const router = new AdaptiveRouter(model, registry);
const evaluator = new CRAGEvaluator(model);
const rewriter = new QueryRewriter(model);
const controller = new RetryController(2);

const GraphState = Annotation.Root({
    messages: Annotation({
        reducer: (prev, next) => prev.concat(next),
        default: () => []
    }),
    current_query: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    current_capability: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    attempts_per_capability: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ({})
    }),
    excluded_capabilities: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => []
    }),
    retrieved_context: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    evaluation_status: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    })
});

async function routeNode(state) {
    const query = state.current_query || state.messages.at(-1)?.content;
    const excluded = state.excluded_capabilities || [];

    console.log(`\n[Router Node] Evaluating query: "${query}" (Excluded: [${excluded.join(", ")}])`);
    const decision = await router.route(query, excluded);
    console.log(`[Router Node] Decided route: [${decision.destination}] | Reason: ${decision.reason}`);
    return {
        current_query: query,
        current_capability: decision.destination
    };
}

async function directNode(state) {
    console.log(`[Direct Node] Generating response directly using LLM parametric knowledge...`);
    const response = await model.invoke(state.messages);
    return {
        messages: [response],
        evaluation_status: "COMPLETED"
    };
}

async function webNode(state) {
    console.log(`[Web Search Node] Querying Tavily live search for: "${state.current_query}"`);
    const result = await webSearchTool.invoke({ query: state.current_query });
    return {
        retrieved_context: result,
        evaluation_status: "READY_TO_GENERATE"
    };
}

async function docsNode(state) {
    console.log(`[MongoDB RAG Node] Querying local MongoDB vector store for: "${state.current_query}"`);
    const result = await docsTool.invoke({ query: state.current_query });
    return {
        retrieved_context: result
    };
}

async function evaluatorNode(state) {
    console.log(`[CRAG Evaluator Node] Evaluating retrieved document quality...`);
    const evaluation = await evaluator.evaluate(state.current_query, state.retrieved_context);
    console.log(`[CRAG Evaluator Node] Grade: [${evaluation.grade}] (Confidence: ${evaluation.confidence})`);
    console.log(`[CRAG Evaluator Node] Reason: ${evaluation.reason}`);
    const controlDecision = controller.handleEvaluationResult(state, evaluation);
    return {
        evaluation_status: controlDecision.status,
        attempts_per_capability: controlDecision.attempts_per_capability,
        excluded_capabilities: controlDecision.excluded_capabilities
    };
}

async function rewriterNode(state) {
    console.log(`[Rewriter Node] Previous retrieval was insufficient. Optimizing query...`);
    const rewrite = await rewriter.rewrite(state.current_query, "Retrieved context did not match or was incomplete");
    console.log(`[Rewriter Node] Reformulated Query: "${rewrite.rewritten_query}"`);
    return {
        current_query: rewrite.rewritten_query
    };
}

async function generatorNode(state) {
    console.log(`[Generator Node] Synthesizing final answer from gathered context...`);

    const prompt = `
    You are an intelligent assistant. Answer the user's question accurately using the provided context.
    
    Context:
    """
    ${state.retrieved_context}
    """
    
    User Question: "${state.current_query}"
    
    Instructions:
    - If the context contains internal documents, state policy accurately.
    - If the context contains web results, synthesize the live facts.
    - Use clean Markdown formatting.
    `;
    const response = await model.invoke([
        ...state.messages.slice(0, -1),
        { role: "user", content: prompt }
    ]);
    return {
        messages: [response],
        evaluation_status: "COMPLETED"
    };
}

function routeDecisionEdge(state) {
    switch (state.current_capability) {
        case "direct":
            return "direct";
        case "web_search":
            return "web_search";
        case "vectorstore":
            return "vectorstore";
        default:
            return "direct";
    }
}

function cragDecisionEdge(state) {
    if (state.evaluation_status === "READY_TO_GENERATE") {
        return "generate";
    }
    // Ambiguous or Incorrect: Loop through rewriter back to router!
    return "rewrite";
}

const workflow = new StateGraph(GraphState)
    .addNode("router", routeNode)
    .addNode("direct", directNode)
    .addNode("web_search", webNode)
    .addNode("vectorstore", docsNode)
    .addNode("evaluator", evaluatorNode)
    .addNode("rewriter", rewriterNode)
    .addNode("generator", generatorNode)
    // Graph Flow
    .addEdge(START, "router")
    .addConditionalEdges("router", routeDecisionEdge, {
        direct: "direct",
        web_search: "web_search",
        vectorstore: "vectorstore"
    })

    // Direct finishes to END
    .addEdge("direct", END)

    // Web search goes straight to generator
    .addEdge("web_search", "generator")

    // MongoDB vector search goes to Evaluator!
    .addEdge("vectorstore", "evaluator")

    // Evaluator conditionally decides: Generate vs Rewrite Loop!
    .addConditionalEdges("evaluator", cragDecisionEdge, {
        generate: "generator",
        rewrite: "rewriter"
    })

    // Rewriter loops BACK to the router with new query and updated exclusions!
    .addEdge("rewriter", "router")

    // Generator finishes to END
    .addEdge("generator", END);


export const app = workflow.compile();

async function askAgent(query) {
    return await app.invoke({
        messages: [{ role: "user", content: query }],
        current_query: query,            // 👈 Set active query for this turn
        attempts_per_capability: {},     // 👈 Clean slate!
        excluded_capabilities: [],       // 👈 Clean slate!
        retrieved_context: "",           // 👈 Clean slate!
        evaluation_status: ""            // 👈 Clean slate!
    });
}

async function runTest() {
    console.log("==================================================");
    console.log(" Testing Full Adaptive CRAG Graph Pipeline ");
    console.log("==================================================");

    // Test 1: Direct Academic Knowledge
    console.log("\n--------------------------------------------------");
    console.log("TEST 1: Einstein's Relativity (Expect: Direct Route)");
    console.log("--------------------------------------------------");
    const res1 = await askAgent("What is Einstein's equation for the theory of relativity?");
    console.log("\n[Final Answer]:\n" + res1.messages.at(-1).content);

    // Test 2: Live Sports Query
    console.log("\n--------------------------------------------------");
    console.log("TEST 2: Real Madrid Score (Expect: Web Search Route)");
    console.log("--------------------------------------------------");
    const res2 = await askAgent("What was the score of the latest Real Madrid football match?");
    console.log("\n[Final Answer]:\n" + res2.messages.at(-1).content);

    //Test 3: NovaTech Policy with CRAG!
    console.log("\n--------------------------------------------------");
    console.log("TEST 3: NovaTech Policy (Expect: VectorStore -> Evaluator -> Generator)");
    console.log("--------------------------------------------------");
    const res3 = await askAgent("How much annual equipment allowance do engineers get at NovaTech?");
    console.log("\n[Final Answer]:\n" + res3.messages.at(-1).content);
    console.log("\n--------------------------------------------------");

    console.log("TEST 4: Vague Slang Query (Expect: VectorStore -> Fail/Ambiguous -> Rewrite -> VectorStore Success)");
    console.log("--------------------------------------------------");
    const res4 = await askAgent("What is the hardware gadget cash for engineers at NovaTech?");
    console.log("\n[Final Answer]:\n" + res4.messages.at(-1).content);
    // Test 5: Missing Information (Tests Complete Self-Correction & Web Fallback Exclusion!)
    console.log("\n--------------------------------------------------");
    console.log("TEST 5: Missing Policy (Expect: VectorStore -> Rewrites -> Exclude VectorStore -> Fallback to Web)");
    console.log("--------------------------------------------------");
    const res5 = await askAgent("Does NovaTech allow employees to bring pet dogs into the office?");
    console.log("\n[Final Answer]:\n" + res5.messages.at(-1).content);
}

runTest().catch(console.error);
