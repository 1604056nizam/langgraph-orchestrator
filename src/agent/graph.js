import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { docsTool } from "../tools/docsTool.js";
import { webSearchTool } from "../tools/webSearchTool.js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

const tools = [docsTool, webSearchTool];
const toolNode = new ToolNode(tools);

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
    temperature: .2
}).bindTools(tools);

async function callModel(state) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
}

const workFlow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition)
    .addEdge("tools", "agent")

export const agent = workFlow.compile();

console.log("Testing Langgraph orchestrator agent.. \n");
console.log("--- Test 1: Casual Chat ---");
const res1 = await agent.invoke({
    messages: [{ role: "user", content: "Hi! What can you help me with?" }]
});

console.log("AI: ", res1.messages[res1.messages.length - 1].content);

console.log("\n--- Test 2: Internal Docs (MongoDB) ---");
const res2 = await agent.invoke({
    messages: [{ role: "user", content: "What is the annual equipment allowance at NovaTech?" }],
});
console.log("AI:", res2.messages[res2.messages.length - 1].content);
console.log("\n--- Test 3: Live Web Search (Tavily/DDG) ---");
const res3 = await agent.invoke({
    messages: [{ role: "user", content: "What was the latest score between Barcelona and Real Madrid?" }],
});
console.log("AI:", res3.messages[res3.messages.length - 1].content);