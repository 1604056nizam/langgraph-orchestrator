import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getQueryEmbedding } from "../services/embeddings.js";
import { vectorStore } from "../db/vectorStore.js";

async function searchKnowledgeBase(query) {
    try {
        const queryVector = await getQueryEmbedding(query);
        const results = await vectorStore.search(queryVector);

        if (results.length === 0) {
            return "";
        }

        console.log(`[VectorStore] Matched ${results.length} chunks (top score: ${results[0].score.toFixed(3)})`);
        return results.map((chunk) => chunk.text).join("\n\n---\n\n");

    } catch (error) {
        console.error("Error searching knowledge base:", error);
    }
}

export const docsTool = tool(
    async ({ query }) => {
        console.log("Searching MongoDB HNSW vector index...");
        const context = await searchKnowledgeBase(query);
        return context || `No matching internal documents found.`;
    },
    {
        name: "search_internal_documents",
        description: "Search internal company policies, benefits, employee information, and organization details from local MongoDB.",
        schema: z.object({
            query: z.string().describe("The specific question or topic to search for in internal documents"),
        })
    }
);
