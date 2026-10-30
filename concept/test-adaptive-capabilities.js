import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import { ChatGroq } from "@langchain/groq";

dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") });

export class BaseCapability {

    constructor(id, name, description) {
        if (this.constructor === BaseCapability) {
            throw new Error("BaseCapability is abstract and cannot be instantiated directly.");
        }

        this.id = id;
        this.name = name;
        this.description = description;
    }

    async execute() {
        throw new Error(`Error() must be implemented by subclass ${this.constructor.name}`);
    }

}

export class DirectCapability extends BaseCapability {
    constructor() {
        super("direct", "General Conversation & Knowledge", `Use for general world knowledge, scientific facts (physics, chemistry), mathematics, programming questions, and general chit-chat that does not require private internal documents or live real-time internet data.`);
    }

    async execute(query) {
        return `[Direct Response Generated for: "${query}"]`;
    }
}

export class WebSearchCapability extends BaseCapability {
    constructor() {
        super("web_search", "Live Web Search", `Use for real-time information, breaking news, live sports scores, current weather, stock prices, or events occurring after model training cutoff.`);
    }

    async execute(query) {
        return `[Tavily Search Results for: "${query}"]`;
    }
}

export class VectorDocsCapability extends BaseCapability {
    constructor() {
        super("vectorstore", "NovaTech Internal Documents", `Use specifically for NovaTech company policies, employee benefits, internal handbook, equipment allowances, leave policies, and organizational procedures.`);
    }

    async execute(query) {
        return `[MongoDB Chunks Retrieved for: "${query}"]`;
    }
}

export class CapabilityRegistry {
    constructor() {
        this.capabilities = new Map();
    }

    register(capability) {
        if (!(capability instanceof BaseCapability)) {
            throw new Error(`Only subclasses of BaseCapability can be registered.`);
        }

        this.capabilities.set(capability.id, capability);
    }

    get(id) {
        return this.capabilities.get(id);
    }

    getAll() {
        return Array.from(this.capabilities.values());
    }

    buildRoutingSchema(excludedIds = []) {
        const available = this.getAll().filter(c => !excludedIds.includes(c.id));

        if (available.length === 0) {
            throw new Error(`No available capabilities remaining to route to!`);
        }

        const validIds = available.map(c => c.id);
        const descriptions = available.map(c => `${c.id}: ${c.description}`);

        return z.object({
            destination: z.enum(validIds).describe(`Destination chosen from: \n ${descriptions}`),
            confidence: z.number().min(0).max(1).describe(`Confidence score between 0.0 and 1.0`),
            reason: z.string().describe(`1-sentence justification for this routing choice`)
        });
    }
}

export class AdaptiveRouter {
    constructor(model, registry) {
        this.model = model;
        this.registry = registry;
    }

    async route(query, excludedIds = []) {
        const schema = this.registry.buildRoutingSchema(excludedIds);
        const structuredModel = this.model.withStructuredOutput(schema);

        const prompt = `You are an expert request router. Analyze the user query and classify it into the single best destination capability.
        User Query: "${query}"
        ${excludedIds.length > 0 ? `Note: The following capabilities are EXCLUDED: [${excludedIds.join(", ")}]` : ""}`;

        return await structuredModel.invoke(prompt);
    }

}


async function runTest() {
    console.log("=== Testing Class-Based Capabilities & Adaptive Router ===\n");
    const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: "openai/gpt-oss-120b",
        temperature: 0
    });
    const registry = new CapabilityRegistry();
    registry.register(new DirectCapability());
    registry.register(new WebSearchCapability());
    registry.register(new VectorDocsCapability());
    const router = new AdaptiveRouter(model, registry);
    // Test 1: Diverse Normal Queries
    const testCases = [
        "What is Einstein's equation for relativity?",
        "What was the score of the latest Real Madrid match?",
        "What is the annual equipment budget at NovaTech?"
    ];
    for (const query of testCases) {
        console.log(`Query: "${query}"`);
        const decision = await router.route(query);
        console.log(`➡️ Route: [${decision.destination}] | Confidence: ${decision.confidence}`);
        console.log(`   Reason: ${decision.reason}\n`);
    }
    // Test 2: Recursion Guard Test (Exclusion logic!)
    console.log("--- Test 2: Testing Loop Prevention (Excluded 'vectorstore') ---");
    const ambiguousQuery = "What is the policy for remote work and home office stipends?";
    console.log(`Query: "${ambiguousQuery}"`);
    console.log("Excluding: ['vectorstore'] (simulating a failed/ambiguous MongoDB search)");
    const fallbackDecision = await router.route(ambiguousQuery, ["vectorstore"]);
    console.log(`➡️ Fallback Route: [${fallbackDecision.destination}]`);
    console.log(`   Reason: ${fallbackDecision.reason}\n`);
}
runTest().catch(console.error);

