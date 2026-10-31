import { z } from "zod";

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