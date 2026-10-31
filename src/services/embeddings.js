import { config } from "../config/index.js";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai"


export const documentEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: config.llm.googleApiKey,
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    model: config.llm.embeddingModel
});

export const queryEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: config.llm.googleApiKey,
    taskType: TaskType.RETRIEVAL_QUERY,
    model: config.llm.embeddingModel
});

export async function getQueryEmbedding(query) {
    return await queryEmbeddings.embedQuery(query);
}

export async function getDocumentsEmbedding(text) {
    return documentEmbeddings.embedDocuments(text)
}