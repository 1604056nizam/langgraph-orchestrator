import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

const EnvSchema = z.object({
    PORT: z.coerce.number().default(3000),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    DB_NAME: z.string().default("chatbot_db"),
    GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
    GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
    TAVILY_API_KEY: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
    server: {
        port: env.PORT
    },
    db: {
        uri: env.MONGODB_URI,
        name: env.DB_NAME,
        collections: {
            knowledgeChunks: "knowledge_chunks"
        },
        vectorIndexName: "vector_index"
    },
    llm: {
        groqApiKey: env.GROQ_API_KEY,
        googleApiKey: env.GOOGLE_API_KEY,
        primaryModel: "openai/gpt-oss-120b",
        primaryTemperature: 0.2,
        searchFallbackTemperature: 0.1,
        geminiSearchModel: "gemini-3.8-flash",
        embeddingModel: "gemini-embedding-001",
        embeddingDimensions: 3072
    },
    rag: {
        topK: 5,
        minSimilarityScore: 0.65,
        chunkSize: 500,
        chunkOverlap: 80,
        defaultMaxRetries: 2
    },
    search: {
        tavilyApiKey: env.TAVILY_API_KEY,
        tavilyMaxResults: 3,
        timeoutMs: 5000
    },
    memory: {
        maxMessagesBeforeSummary: 10,
        recentMessagesToKeep: 4
    }
})

