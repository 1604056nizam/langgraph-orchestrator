import { BaseCapability } from "./BaseCapability.js";
import { webSearchTool } from "../tools/webSearchTool.js";

export class WebSearchCapability extends BaseCapability {
    constructor() {
        super("web_search", "Live Web Search", `Use for real-time information, breaking news, live sports scores, current weather, stock prices, or events occurring after model training cutoff.`);
    }

    async execute(query) {
        return await webSearchTool.invoke({ query });
    }
}

