import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./src/config/index.js";
import { agent } from "./src/agent/graph.js";
import { HumanMessage } from "@langchain/core/messages";
import { findAvailablePort } from "./src/utils/portFinder.js";
import { Command } from "@langchain/langgraph";

const app = express();
const PORT = config.server.nodeEnv === "production" ? config.server.port : await findAvailablePort(config.server.port);

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

        const pendingInterrupt = state.tasks?.[0]?.interrupts?.[0]?.value || null;
        res.json({ messages: formatted, pendingInterrupt });
    } catch (err) {
        console.error("Error in /api/history:", err);
        res.json({ messages: [] });
    }
});

app.post("/api/chat", async (req, res) => {
    const { message, sessionId = "default-session" } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }
    await streamGraphToClient(
        {
            messages: [new HumanMessage(message)],
            current_query: message,
            attempts_per_capability: {},
            excluded_capabilities: [],
            retrieved_context: "",
            evaluation_status: ""
        },
        sessionId,
        res
    );
});
async function streamGraphToClient(graphInput, sessionId, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const threadConfig = {
        version: "v2",
        configurable: { thread_id: sessionId }
    };
    try {
        const eventStream = agent.streamEvents(graphInput, threadConfig);
        for await (const event of eventStream) {
            const isFinalOutput = event.tags?.includes("final_output");
            if (event.event === "on_chat_model_stream" && event.data?.chunk.content && isFinalOutput) {
                const token = event.data.chunk.content;
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
        // Check if the graph paused at an interrupt()
        const snapshot = await agent.getState(threadConfig);
        const pendingInterrupt = snapshot.tasks?.[0]?.interrupts?.[0]?.value;
        if (pendingInterrupt) {
            res.write(`data: ${JSON.stringify({ type: "interrupt", payload: pendingInterrupt })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
    } catch (error) {
        console.error("Streaming error:", error);
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
    }
}

app.post("/api/chat/resume", async (req, res) => {
    const { decision, sessionId = "default-session" } = req.body;
    if (!decision) {
        return res.status(400).json({ error: "Decision ('approve' or 'reject') is required" });
    }
    await streamGraphToClient(new Command({ resume: decision }), sessionId, res);
});

app.listen(PORT, () => {
    console.log(`LangGraph Orchestrator server running!`);
    console.log(`Open your browser at: http://localhost:${PORT}\n`);
});