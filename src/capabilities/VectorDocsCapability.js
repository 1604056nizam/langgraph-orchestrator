import { BaseCapability } from "./BaseCapability.js";
import { docsTool } from "../tools/docsTool.js";

export class VectorDocsCapability extends BaseCapability {
    constructor() {
        super("vectorstore", "NovaTech Internal Documents", `Use specifically for NovaTech company policies, employee benefits, internal handbook, equipment allowances, leave policies, and organizational procedures.`);
    }

    async execute(query) {
        return await docsTool.invoke({ query });
    }
}
