import dotenv from "dotenv";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { search as duckSearch } from "duck-duck-scrape";
import path from "path";
import { ChatGroq } from "@langchain/groq";
import { tavily } from "@tavily/core";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

const withTimeout = (promise, ms = 5000) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
    ]);

async function searchGoogle(query) {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    const response =
        await withTimeout(ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: `Search the web and provide a clear, factual answer for: ${query}`,
            config: {
                thinkingConfig: {
                    thinkingBudget: 0,
                },
            },
        }, 5000));
    return response.text;
}

async function searchWithTavily(query) {
    if (!process.env.TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY not configured in .env");
    }

    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const response = await tvly.search(query, { max_results: 3 });
    const result = response.results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
        .join("\n\n");

    if (!result) throw new Error("No Tavily result found!");

    return result;
}

async function searchWithGroq(query) {
    const groqSearchModel = new ChatGroq({
        model: "openai/gpt-oss-120b",
        apiKey: process.env.GROQ_API_KEY,
        temperature: 0.1,
    });
    const prompt = `You are a real-time factual knowledge search engine. Provide an accurate, comprehensive, and up-to-date factual answer for this query:\n\nQuery: ${query}`;
    const response = await groqSearchModel.invoke(prompt);
    return response.content;
}

async function searchDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.AbstractText) {
        return `Answer: ${data.AbstractText}\nSource: ${data.AbstractURL || "DuckDuckGo"}`;
    }
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        const top = data.RelatedTopics.slice(0, 3)
            .filter(t => t.Text)
            .map((t, i) => `[${i + 1}] ${t.Text}`);
        if (top.length > 0) return top.join("\n\n");
    }
    return "No direct web result found on DuckDuckGo.";
}


export const webSearchTool = tool(
    async ({ query }) => {
        try {
            console.log("Searching tavily");
            return await searchWithTavily(query);
        } catch (error) {
            console.log("Tavily search failed, switching to groq");
            try {
                console.log("Searching groq");
                return await searchWithGroq(query);
            } catch (e) {
                console.warn(`Google search failed or rate limited (${e.message}). Switching to duckduckgo!`);
                return await searchDuckDuckGo(query);
            }
        }
    },
    {
        name: "web_search",
        description: "Search the live web for recent news, real-time facts, current events, or general knowledge.",
        schema: z.object({
            query: z.string().describe("The search query to look up on the web"),
        })
    }
);

const res = await webSearchTool.invoke({ query: "score of real madrid vs barcelone" });
console.log(res);
