import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatGroq } from "@langchain/groq";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey: process.env.GOOGLE_API_KEY,
});


const rawText = await fs.readFile("knowledge.txt", "utf-8");

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 40,
});


const docs = await splitter.createDocuments([rawText]);

console.log(`created ${docs.length} chunks`);
console.log(`sample chunks 1 : ${docs[0].pageContent}`);

const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful assistant. Use ONLY the following context to answer the question. If the answer is not in the context, say "I don't know based on the provided documents." Context: {context}`],
    ["human", "{question}"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());


async function ask(question) {
    const docs = await vectorStore.similaritySearch(question);
    const context = docs.map((doc) => doc.pageContent).join("\n");
    const response = await chain.stream({
        "context": context,
        "question": question,
    });
    console.log(`Question: ${question}`);
    for await (const chunk of response) {
        process.stdout.write(chunk);
    }

}

await ask("What is the working hour??");