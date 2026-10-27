import { MongoClient } from "mongodb";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

async function ingest() {
    console.log("Connecting to db");
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    const db = client.db("chatbot_db");
    const collection = db.collection("knowledge_chunks");

    console.log("Reading the raw data");
    const filePath = path.resolve(import.meta.dirname, "../../concept/knowledge.txt");
    const rawText = await fs.readFile(filePath, "utf-8");

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 200,
        chunkOverlap: 40
    });

    const docs = await splitter.createDocuments([rawText]);

    console.log(`created ${docs.length} chunks from document. `);

    const embedding = new GoogleGenerativeAIEmbeddings({
        model: "gemini-embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        apiKey: process.env.GOOGLE_API_KEY,
    });

    await collection.deleteMany({});
    console.log("Cleared previous chunks from mongodb");

    console.log("Generating embeddings and inserting into db");
    for (const [chunkIndex, chunk] of docs.entries()) {
        const text = chunk.pageContent;
        const vector = await embedding.embedQuery(text);

        await collection.insertOne({
            text,
            vector,
            source: "knowledge.txt",
            chunkIndex: chunkIndex,
            createdAt: new Date(),
        });
    }

    console.log("Ingestion completed!");
    await client.close();
}


ingest().catch(err => {
    console.error("Error during ingestion:", err);
    process.exit(1);
});

