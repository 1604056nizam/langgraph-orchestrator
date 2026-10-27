import dotenv from "dotenv";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai"
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";

dotenv.config({ path: "../.env" });


const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey: process.env.GOOGLE_API_KEY,
})

const vectorStore = await MemoryVectorStore.fromTexts(
    [
        "JavaScript is a language primarily used for web browsers.",
        "Bananas are yellow fruits packed with potassium.",
        "Dogs are domesticated mammals known for their loyalty.",
        "React is a JavaScript library for building user interfaces.",
    ],

    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    embeddings
)

const retiever = vectorStore.asRetriever(2);
const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful assistant. Use ONLY the following context to answer the question. If the answer is not in the context, say "I don't know based on the provided documents." Context: {context}`],
    ["human", "{question}"],
])

const searchResult = await vectorStore.similaritySearch("Canine Animals", 1);


console.log("Top match: ", searchResult[0].pageContent);
