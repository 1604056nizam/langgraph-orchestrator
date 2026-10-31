import dotenv from "dotenv";
import path from "path";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") })

const grade = ["CORRECT", "INCORRECT", "AMBIGUOUS"];

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0
});

const EvaluationSchema = z.object({
    confidence: z.number().min(0).max(1).describe(`Confidence score between 0.0 and 1.0`),
    grade: z.enum(grade).describe(`'CORRECT': The document clearly and directly answers the question. " +
        "'AMBIGUOUS': The document is partially relevant or related, but lacks complete details to fully answer. " +
        "'INCORRECT': The document is irrelevant, tangential, or does not address the question at all.`),
    reason: z.string().describe("1-2 sentence explaining for the grade")
});

export class CRAGEvaluator {
    constructor(llm) {
        this.structuredEvaluator = llm.withStructuredOutput(EvaluationSchema);
    }

    async evaluate(query, documentContext) {
        const prompt = `You are an impartial grader evaluating whether a retrieved document context is relevant and sufficient to answer a user's question.
        User Question: "${query}"
        Retrieved Context: """${documentContext || "[NO CONTEXT RETRIEVED]"}"""
        Evaluate the relevance and completeness of the retrieved context.`;


        return await this.structuredEvaluator.invoke(prompt);
    }
}

const RewriterSchema = z.object({
    rewritten_query: z.string().describe(`The reformulated search query optimized for vector or keyword retrieval`),
    reason: z.string().describe("Why the query was rewrittern this way")
});

export class QueryRewriter {
    constructor(llm) {
        this.structuredRewriter = llm.withStructuredOutput(RewriterSchema);
    }

    async rewrite(originalQuery, evaluationReason) {
        const prompt = `
        You are a search query optimizer. The previous search failed or was incomplete because: "${evaluationReason}".
        
        Original User Query: "${originalQuery}"
        
        Rewrite this query to be clear, keyword-rich, and optimized for document retrieval. Strip out conversational filler, slang, or ambiguity.`;

        return await this.structuredRewriter.invoke(prompt);
    }
}

// Dynamic retry and exclusion controller

export class RetryController {
    constructor(maxRetries = 2) {
        this.maxRetries = maxRetries;
    }

    //dynamically determines whether to retry or exclude the capability that just ran

    handleEvaluationResult(state, evaluation) {
        const currentCap = state.current_capability;
        const attempts = { ...state.attempts_per_capability };
        const currentCount = (attempts[currentCap] || 0) + 1;
        attempts[currentCap] = currentCount;

        if (evaluation.grade === "CORRECT") {
            return {
                status: "READY_TO_GENERATE",
                attempts_per_capability: attempts,
                excluded_capabilities: state.excluded_capabilities
            }
        }

        if (currentCount >= this.maxRetries) {
            console.log(`Capability '${currentCap}' reached max retries (${currentCount}/${this.maxRetries}). DYNAMICALLY EXCLUDING it!`);

            return {
                status: "EXCLUDE_AND_RE_ROUTE",
                attempts_per_capability: attempts,
                excluded_capabilities: [...state.excluded_capabilities, currentCap]
            };
        }

        console.log(`Capability '${currentCap}' attempt ${currentCount}/${this.maxRetries}. Will retry with new query.`);
        return {
            status: "RETRY_CURRENT",
            attempts_per_capability: attempts,
            excluded_capabilities: state.excluded_capabilities
        };
    }
}


async function runTest() {
    console.log("=== Testing CRAG Evaluator & Dynamic Retry Controller ===\n");

    const evaluator = new CRAGEvaluator(model);
    const rewriter = new QueryRewriter(model);
    const controller = new RetryController(2);

    // Test Scenario: A query that fails on attempt 1, gets rewritten, and succeeds or exhausts budget
    const userQuery = "How much cash do I get for tech gadgets?";
    // Simulated Bad Document Match on Attempt 1 (e.g. from MongoDB)
    const badContext = "NovaTech office hours are 9:00 AM to 5:00 PM Monday through Friday. Lunch break is 1 hour.";

    console.log(`[Scenario]: User asks: "${userQuery}"`);
    console.log(`[Attempt 1 Context]: "${badContext}"\n`);

    const eval1 = await evaluator.evaluate(userQuery, badContext);
    console.log(`Evaluation 1: Grade=[${eval1.grade}] (Confidence: ${eval1.confidence})`);
    console.log(`Reason: ${eval1.reason}\n`);

    let state = {
        current_capability: 'vectorstore',
        attempts_per_capability: {},
        excluded_capabilities: [],
    }

    let decision1 = controller.handleEvaluationResult(state, eval1);
    state = { ...state, ...decision1 };

    console.log(`Controller Decision 1: Status = ${decision1.status}`)
    console.log(`Excluded Capabilities: [${state.excluded_capabilities.join(", ")}]\n`);

    // 3. Rewrite query for Attempt 2
    const rewrite1 = await rewriter.rewrite(userQuery, eval1.reason);
    console.log(`Query Rewritten: "${rewrite1.rewritten_query}"`);
    console.log(`Rewrite Reason: ${rewrite1.reason}\n`);

    // 4. Simulate Attempt 2 Failing Again (to test dynamic exclusion)
    console.log("--- Simulating Attempt 2 Failing Again ---");
    const eval2 = await evaluator.evaluate(rewrite1.rewritten_query, "NovaTech health benefits cover dental and medical.");
    let decision2 = controller.handleEvaluationResult(state, eval2);
    state = { ...state, ...decision2 };

    console.log(`Controller Decision 2: Status = ${decision2.status}`);
    console.log(`Excluded Capabilities: [${state.excluded_capabilities.join(", ")}] 🎯 (Notice: Dynamically excluded!)`);
}

if (process.argv[1]?.endsWith("test-crag-evaluator.js")) {
    runTest().catch(console.error);
}
