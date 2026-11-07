import { config } from "../config/index.js";

export class BaseCapability {

    constructor(id, name, description, mode = "context", requiresEvaluation = false, maxRetries = config.rag.defaultMaxRetries) {
        if (this.constructor === BaseCapability) {
            throw new Error("BaseCapability is abstract and cannot be instantiated directly.");
        }

        if (!id || !name || !description) {
            throw new Error("Capability requires id, name, and description.");
        }

        this.id = id;
        this.name = name;
        this.description = description;
        this.mode = mode;
        this.requiresEvaluation = requiresEvaluation;
        this.maxRetries = maxRetries;
    }

    async execute(query, state = {}) {
        throw new Error(`Error() must be implemented by subclass ${this.constructor.name}`);
    }

    async commit(actionProposal) {
        throw new Error(`commit() must be implemented by action capability ${this.constructor.name}`);
    }

}
