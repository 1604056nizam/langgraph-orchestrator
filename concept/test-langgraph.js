import "dotenv/config";
import dotenv from "dotenv";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";

dotenv.config({ path: "../.env" });
const rawText = await fs.readFile("./knowledge.txt", "utf-8");
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 40,
});
const docs = await splitter.createDocuments([rawText]);
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey: process.env.GOOGLE_API_KEY,
});

const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

const searchPolicyTool = tool(
    async ({ query }) => {
        const results = await vectorStore.similaritySearch(query, 2);
        return results.map((d) => d.pageContent).join("\n")
    },
    {
        name: "search_policy",
        description: "Use this tool when you need to search for information in the policy documents",
        schema: z.object({
            query: z.string(),
        }),
    }
);

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
});

const tools = [searchPolicyTool];
const modeWithTools = model.bindTools(tools);
const toolNode = new ToolNode(tools);

async function callModel(state) {
    const response = await modeWithTools.invoke(state.messages);
    return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition)
    .addEdge("tools", "agent")

const app = workflow.compile();

const result = await app.invoke({
    messages: [{ role: "user", content: "Hello, what can you do?" }],
});

const lastMessage = result.messages[result.messages.length - 1];
console.log("Last message:", lastMessage.content);

const result2 = await app.invoke({
    messages: [{ role: "user", content: "What is the annual equipment allowance at NovaTech?" }],
});

const lastMessage2 = result2.messages[result2.messages.length - 1];
console.log("Last message:", lastMessage2.content);
