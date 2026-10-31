import { z } from "zod";
import { BaseCapability } from "./BaseCapability.js";

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
        const descriptions = available.map(c => `${c.id}: ${c.description}`).join("\n");

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
