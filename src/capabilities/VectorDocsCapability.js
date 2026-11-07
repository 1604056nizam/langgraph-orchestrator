import { BaseCapability } from "./BaseCapability.js";
import { docsTool } from "../tools/docsTool.js";

export class VectorDocsCapability extends BaseCapability {
    constructor() {
        super(
            "vectorstore",
            "Nova Tech internal documents",
            `Use specifically if queried anything about Nova tech principal, actions, employees, policies etc`,
            "context",
            true
        );
    }

    async execute(query) {
        return await docsTool.invoke({ query });
    }
}
