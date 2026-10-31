import dotenv from "dotenv";
import path from "path";
import { ChatGroq } from "@langchain/groq";
import { DirectCapability } from "../capabilities/DirectCapability.js";
import { WebSearchCapability } from "../capabilities/WebSearchCapability.js";
import { VectorDocsCapability } from "../capabilities/VectorDocsCapability.js";
import { CapabilityRegistry, AdaptiveRouter } from "../capabilities/CapabilityRegistry.js";
import { CRAGEvaluator } from "../services/evaluator.js";
import { QueryRewriter } from "../services/queryRewriter.js";
import { RetryPolicy } from "./policies/retryPolicy.js";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });


export const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0.2
});


export const registry = new CapabilityRegistry();
registry.register(new DirectCapability());
registry.register(new WebSearchCapability());
registry.register(new VectorDocsCapability());
const router = new AdaptiveRouter(model, registry);
const evaluator = new CRAGEvaluator(model);
const rewriter = new QueryRewriter(model);
const retryPolicy = new RetryPolicy(2);


export async function routeNode(state) {
    const query = state.current_query || state.messages.at(-1)?.content;
    const excluded = state.excluded_capabilities || [];
    console.log(`\n[Router Node] Evaluating: "${query}" (Excluded: [${excluded.join(", ")}])`);
    const decision = await router.route(query, excluded);
    console.log(`[Router Node] ➡️ Decided route: [${decision.destination}] | Reason: ${decision.reason}`);
    return {
        current_query: query,
        current_capability: decision.destination
    };
}

export async function directNode(state) {
    console.log(`[Direct Node] Answering with parametric knowledge...`);
    const response = await model.invoke(state.messages);
    return {
        messages: [response],
        evaluation_status: "COMPLETED"
    }
}

export async function webNode(state) {
    console.log(`[Web Search Node] Searching live web for: "${state.current_query}"`);
    const webCapability = registry.get("web_search");
    const result = await webCapability.execute(state.current_query);
    return {
        retrieved_context: result,
        evaluation_status: "READY_TO_GENERATE"
    };
}

export async function docsNode(state) {
    console.log(`[MongoDB RAG Node] Querying MongoDB for: "${state.current_query}"`);
    const docsCapability = registry.get("vectorstore");
    const result = await docsCapability.execute(state.current_query);
    return {
        retrieved_context: result
    };
}

export async function evaluatorNode(state) {
    console.log(`[CRAG Evaluator Node] Evaluating context quality...`);
    const evaluation = await evaluator.evaluate(state.current_query, state.retrieved_context);
    console.log(`[CRAG Evaluator Node] Grade: [${evaluation.grade}] (Confidence: ${evaluation.confidence})`);
    const policyDecision = retryPolicy.evaluateNextStep(state, evaluation, registry);
    return {
        evaluation_status: policyDecision.status,
        evaluation_reason: evaluation.reason,
        attempts_per_capability: policyDecision.attempts_per_capability,
        excluded_capabilities: policyDecision.excluded_capabilities
    };
}

export async function rewriterNode(state) {
    console.log(`[Rewriter Node] Optimizing query for retry...`);
    const reason = state.evaluation_reason || "Previous context was incomplete or irrelevant"
    const rewrite = await rewriter.rewrite(state.current_query, reason);
    console.log(`[Rewriter Node] Reformulated Query: "${rewrite.rewritten_query}"`);

    return {
        current_query: rewrite.rewritten_query
    };

}

export async function generatorNode(state) {
    console.log(`[Generator Node] Synthesizing final answer...`);
    const prompt = `
    You are an intelligent assistant. Answer the user's question accurately using the provided context.
    
    Context:
    """
    ${state.retrieved_context}
    """
    
    User Question: "${state.current_query}"
    
    Instructions:
    - If the context contains internal documents, state the policy accurately.
    - If the context contains web search results, synthesize the live facts.
    - Format response in clean Markdown.
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