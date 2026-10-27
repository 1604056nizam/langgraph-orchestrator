import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getQueryEmbedding } from "../services/embeddings.js";
import { getCollection, closeDb } from "./connection.js";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

async function ingest() {
    const collection = await getCollection("knowledge_chunks");
    console.log("Reading the raw data");
    const filePath = path.resolve(import.meta.dirname, "../../concept/knowledge.txt");
    const rawText = await fs.readFile(filePath, "utf-8");

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 200,
        chunkOverlap: 40
    });

    const docs = await splitter.createDocuments([rawText]);

    console.log(`created ${docs.length} chunks from document. `);


    await collection.deleteMany({});
    console.log("Cleared previous chunks from mongodb");

    console.log("Generating embeddings and inserting into db");
    for (const [chunkIndex, chunk] of docs.entries()) {
        const text = chunk.pageContent;
        const vector = await getQueryEmbedding(text);

        await collection.insertOne({
            text,
            vector,
            source: "knowledge.txt",
            chunkIndex: chunkIndex,
            createdAt: new Date(),
        });
    }

    console.log("Ingestion completed!");
    await closeDb();
}


ingest().catch(err => {
    console.error("Error during ingestion:", err);
    process.exit(1);
});

