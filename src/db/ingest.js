import fs from "fs/promises";
import { config } from "../config/index.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getDocumentsEmbedding } from "../services/embeddings.js";
import { vectorStore } from "./vectorStore.js";
import { getCollection, closeDb } from "./connection.js";
import path from "path";

async function ingest() {
    console.log("Reading the raw data");
    const filePath = path.resolve(import.meta.dirname, "../../concept/knowledge.txt");
    const rawText = await fs.readFile(filePath, "utf-8");

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: config.rag.chunkSize,
        chunkOverlap: config.rag.chunkOverlap
    });

    const docs = await splitter.createDocuments([rawText]);

    console.log(`created ${docs.length} chunks from document. `);
    console.log("Generating batch document embeddings...");

    const texts = docs.map((doc) => doc.pageContent);
    const vectors = await getDocumentsEmbedding(texts);

    const chunkRecords = docs.map((doc, index) => ({
        text: doc.pageContent,
        vector: vectors[index],
        source: "knowledge.txt",
        chunkIndex: index,
        createdAt: new Date()
    }));

    console.log("Saving chunks into MongoDB...");
    await vectorStore.replaceAllChunks(chunkRecords);
    await vectorStore.ensureVectorIndex();
    console.log("Ingestion & HNSW Vector Index completed!");
    await closeDb();
}


ingest().catch(err => {
    console.error("Error during ingestion:", err);
    process.exit(1);
});

