import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { agent } from "./src/agent/graph.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(import.meta.dirname, "public")));

const sessions = new Map();

app.post("/api/chat", async (req, res) => {
    const { message, sessionId = "default-session" } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
    }

    const history = sessions.get(sessionId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const inputMessages = [...history, { role: "user", content: message }];
        const eventStream = agent.streamEvents(
            { messages: inputMessages },
            { version: "v2" }
        );

        let finalAIMessage = "";

        for await (const event of eventStream) {
            if (event.event === "on_chat_model_stream" && event.data?.chunk.content) {
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

        history.push({ role: "user", content: message });
        if (finalAIMessage) {
            history.push({ role: "assistant", content: finalAIMessage });
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