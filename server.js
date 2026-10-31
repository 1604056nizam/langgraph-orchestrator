import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { agent } from "./src/agent/graph.js";
import { messageToGroqRole } from "@langchain/groq";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(import.meta.dirname, "public")));

app.get("/api/history/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const state = await agent.getState({
            configurable: { thread_id: sessionId }
        });

        const messages = state.values?.messages || [];
        const formatted = messages.map(msg => ({
            role: msg._getType() === "human" ? "user" : "assistant",
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
        }));

        res.json({ messages: formatted });
    } catch (err) {
        res.json({ messages: [] });
    }
});

app.post("/api/chat", async (req, res) => {
    const { message, sessionId = "default-session" } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const inputMessage = [{ role: "user", content: message }];
        const eventStream = agent.streamEvents(
            {
                messages: inputMessage,
                current_query: message,
                attempts_per_capability: {},
                excluded_capabilities: [],
                retrieved_context: "",
                evaluation_status: ""
            },
            {
                version: "v2",
                configurable: { thread_id: sessionId }
            },
        );

        let finalAIMessage = "";

        for await (const event of eventStream) {
            const currentNode = event.metadata?.langgraph_node;
            if (event.event === "on_chat_model_stream" && event.data?.chunk.content && ((currentNode === "generator" || currentNode === "direct"))) {
                const token = event.data.chunk.content;
                finalAIMessage += token;
                res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
            }

            if (event.event === "on_tool_start") {
                res.write(`data: ${JSON.stringify({
                    type: "tool_start",
                    tool: event.name,
                    input: event.data?.input
                })}\n\n`);
            }

            if (event.event === "on_tool_end") {
                res.write(`data: ${JSON.stringify({
                    type: "tool_end",
                    tool: event.name,
                    output: typeof event.data?.output == "string" ? event.data.output.slice(0, 300) + "..." : "Complete",
                })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();

    } catch (error) {
        console.error("Streaming error:", error);
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
    }

});

app.listen(PORT, () => {
    console.log(`LangGraph Orchestrator server running!`);
    console.log(`Open your browser at: http://localhost:${PORT}\n`);
});