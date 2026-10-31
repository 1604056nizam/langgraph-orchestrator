import { config } from "../config/index.js";
import { ChatGroq } from "@langchain/groq";
import { DirectCapability } from "../capabilities/DirectCapability.js";
import { WebSearchCapability } from "../capabilities/WebSearchCapability.js";
import { VectorDocsCapability } from "../capabilities/VectorDocsCapability.js";
import { CapabilityRegistry, AdaptiveRouter } from "../capabilities/CapabilityRegistry.js";
import { CRAGEvaluator } from "../services/evaluator.js";
import { QueryRewriter } from "../services/queryRewriter.js";
import { RetryPolicy } from "./policies/retryPolicy.js";

export const model = new ChatGroq({
    apiKey: config.llm.groqApiKey,
    model: config.llm.primaryModel,
    temperature: config.llm.primaryTemperature
});

export const registry = new CapabilityRegistry();
registry.register(new DirectCapability(model));
registry.register(new WebSearchCapability());
registry.register(new VectorDocsCapability());
const router = new AdaptiveRouter(model, registry);
const evaluator = new CRAGEvaluator(model);
const rewriter = new QueryRewriter(model);
const retryPolicy = new RetryPolicy(config.rag.defaultMaxRetries);

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

export async function executeCapabilityNode(state) {
    const capability = registry.get(state.current_capability);
    if (!capability) {
        throw new Error(`Capability '${state.current_capability}' is not registered.`);
    }

    console.log(`[Capability Executor] Running '${capability.name}' (${capability.id}) | mode=${capability.mode}`);
    const output = await capability.execute(state.current_query, state);

    if (capability.mode === "direct") {
        return {
            messages: [output],
            evaluation_status: "COMPLETED"
        }
    }

    return {
        retrieved_context: output,
        evaluation_status: capability.requiresEvaluation ? "NEEDS_EVALUATION" : "READY_TO_GENERATE"
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
    const response = await model.invoke(
        [
            ...state.messages.slice(0, -1),
            { role: "user", content: prompt }
        ],
        { tags: ["final_output"] }
    );

    return {
        messages: [response],
        evaluation_status: "COMPLETED"
    };
}