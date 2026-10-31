import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { config } from "../config/index.js";
import { cosineSimilarity } from "../utils/vectorMath.js";
import { getQueryEmbedding } from "../services/embeddings.js";
import { getCollection } from "../db/connection.js";

async function searchKnowledgeBase(query, limit = config.rag.topK) {
    try {
        const collection = await getCollection(config.db.collections.knowledgeChunks);
        const queryVector = await getQueryEmbedding(query);
        const chunks = await collection.find({}).toArray();

        const scoredChunks = chunks.map((chunk) => ({
            text: chunk.text,
            score: cosineSimilarity(queryVector, chunk.vector)
        }));

        scoredChunks.sort((a, b) => b.score - a.score);

        const topChunks = scoredChunks.slice(0, limit);
        return topChunks.map((chunk) => chunk.text).join("\n");
    } catch (error) {
        console.error("Error searching knowledge base:", error);
    }
}

export const docsTool = tool(
    async ({ query }) => {
        console.log("Searching local moongodb knowledgebase");
        const context = await searchKnowledgeBase(query);
        return context || `No knowledge found`;
    },
    {
        name: "search_internal_documents",
        description: "Search internal company policies, benefits, employee information, and organization details from local MongoDB.",
        schema: z.object({
            query: z.string().describe("The specific question or topic to search for in internal documents"),
        })
    }
);
