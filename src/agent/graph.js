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