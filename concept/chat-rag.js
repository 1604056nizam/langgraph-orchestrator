import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai"
import dotenv from "dotenv";
import { ChatGroq } from "@langchain/groq";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";


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

const vectorStore = await MemoryVectorStore.fromTexts([
    "Bangladesh is a country in South Asia.",
    "The capital of Bangladesh is Dhaka.",
    "The currency of Bangladesh is the Taka.",
], [{ id: 1 }, { id: 2 }, { id: 3 }],
    embeddings);

const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an assistant for question-answering tasks. Use ONLY the following context to answer the question. If the answer is not in the context, say "I don't know based on the provided documents." Context: {context}`],
    ["human", "{question}"]
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

async function askRAG(question) {
    const docs = await vectorStore.similaritySearch(question);
    const context = docs.map((doc) => doc.pageContent).join("\n");

    const response = await chain.invoke({
        "context": context,
        "question": question,
    });

    console.log(`Question: ${question}`);
    console.log(`Answer: ${response}`);
}

await askRAG("What is the currency of Bangladesh?");
await askRAG("What is the poplation of New york?");