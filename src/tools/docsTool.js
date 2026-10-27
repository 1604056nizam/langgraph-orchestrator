import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

function dotProduct(vecA, vecB) {
    return vecA.reduce((sum, val, idx) => sum + val * vecB[idx], 0);
}

function magnitude(vec) {
    return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(vecA, vecB) {
    return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}

async function searchKnowledgeBase(query, limit = 1) {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    try {
        const db = client.db("chatbot_db");
        const collection = db.collection("knowledge_chunks");
        const embedding = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY,
            model: "gemini-embedding-001",
            taskType: TaskType.RETRIEVAL_DOCUMENT,
        });

        const queryVector = await embedding.embedQuery(query);
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
    } finally {
        await client.close();
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

// Quick self-test run: node src/tools/docsTool.js
// const testResult = await docsTool.invoke({ query: "What is the equipment allowance?" });
// console.log("\n--- Top Retrieved Context from MongoDB ---");
// console.log(testResult);
