import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") });

const client = new MongoClient(process.env.MONGODB_URI);

const checkpointer = new MongoDBSaver({
    client,
    dbName: "chatbot_db"
});

const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0.2
});


async function callModel(state) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addEdge(START, "agent")
    .addEdge("agent", END);


const app = workflow.compile({ checkpointer });

async function runTest() {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const threadConfig = {
        configurable: { thread_id: "nizam-persistent-thread-1" }
    };

    console.log("\n--- Turn 1: Storing information into MongoDB ---");
    const turn1 = await app.invoke(
        { messages: [{ role: "user", content: "Hi! My name is Nizam and my favorite food is Biryani." }] },
        threadConfig
    );
    console.log("Agent:", turn1.messages.at(-1).content);

    console.log("\n--- Turn 2: Asking a question (loaded from MongoDB!) ---");
    const turn2 = await app.invoke(
        { messages: [{ role: "user", content: "What is my favorite food?" }] },
        threadConfig
    );
    console.log("Agent:", turn2.messages.at(-1).content);

    console.log("\n--- Turn 3: Inspecting State from MongoDB Checkpointer ---");
    const savedState = await app.getState(threadConfig);
    console.log(`Saved messages count in MongoDB: ${savedState.values.messages.length}`);

    await client.close();
    console.log("\nDatabase connection closed. Test finished!");
}

runTest().catch(console.error);