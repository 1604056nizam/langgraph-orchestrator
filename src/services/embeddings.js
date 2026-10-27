import dotenv from "dotenv";
import path from "path";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai"

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

export const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    model: "gemini-embedding-001"
});

export async function getQueryEmbedding(query) {
    return await embeddings.embedQuery(query);
}

export async function getDocumentsEmbedding(text) {
    return embeddings.embedDocuments(text)
}