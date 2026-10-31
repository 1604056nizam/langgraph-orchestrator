import { BaseCapability } from "./BaseCapability.js";

export class DirectCapability extends BaseCapability {
    constructor(model) {
        super("direct", "General Conversation & Knowledge", `Use for general world knowledge, scientific facts (physics, chemistry), mathematics, programming questions, and general chit-chat that does not require private internal documents or live real-time internet data.`, "direct", false);
        this.model = model;
    }

    async execute(query, state = {}) {
        //return `[Direct Response Generated for: "${query}"]`;
        return await this.model.invoke(state.messages, {
            tags: ["final_output"]
        });
    }
}