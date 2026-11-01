import { BaseCapability } from "./BaseCapability.js";
import { docsTool } from "../tools/docsTool.js";

export class VectorDocsCapability extends BaseCapability {
    constructor() {
        super("vectorstore", "Principal Software Engineer Internal Documents", `Use specifically if queried anything about principal software engineers qualification, responsibility, expectations`, "context", true);
    }

    async execute(query) {
        return await docsTool.invoke({ query });
    }
}
