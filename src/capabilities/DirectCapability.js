import { BaseCapability } from "./BaseCapability.js";

export class DirectCapability extends BaseCapability {
    constructor() {
        super("direct", "General Conversation & Knowledge", `Use for general world knowledge, scientific facts (physics, chemistry), mathematics, programming questions, and general chit-chat that does not require private internal documents or live real-time internet data.`);
    }

    async execute(query, state = {}) {
        //return `[Direct Response Generated for: "${query}"]`;
        return null;
    }
}