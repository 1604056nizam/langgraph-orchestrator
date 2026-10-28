import dotenv from "dotenv";
import path from "path";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation, MemorySaver, START, END } from "@langchain/langgraph";

dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") });


const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
    temperature: .2
});

async function callModel(state) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
}

const workFlow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addEdge(START, "agent")
    .addEdge("agent", END)


const checkpointer = new MemorySaver();
const app = workFlow.compile({ checkpointer });


async function runTest() {
    const config1 = { configurable: { thread_id: "thread-1" } };
    const response1 = await app.invoke({ messages: [{ role: "user", content: "Hi! My name is Nizam and I love LangGraph!" }] }, config1);
    console.log(response1.messages[response1.messages.length - 1].content);

    const response2 = await app.invoke({ messages: [{ role: "user", content: "What is my name and what do i love?" }] }, config1);
    console.log(response2.messages[response2.messages.length - 1].content);


    const config2 = { configurable: { thread_id: "thread- 2" } };
    const response3 = await app.invoke({ messages: [{ role: "user", content: "What is my name and what do it love?" }] }, config2);
    console.log(response3.messages[response3.messages.length - 1].content);

    const savedState = await app.getState(config1);
    console.log(savedState);
}

runTest().catch(error => {
    console.error(error);
})

