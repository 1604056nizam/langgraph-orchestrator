import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { search as duckSearch } from "duck-duck-scrape";
import { ChatGroq } from "@langchain/groq";
import { tavily } from "@tavily/core";
import { config } from "../config/index.js";

const withTimeout = (promise, ms = config.search.timeoutMs) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
    ]);

async function searchGoogle(query) {
    const ai = new GoogleGenAI({ apiKey: config.llm.googleApiKey });
    const response =
        await withTimeout(ai.models.generateContent({
            model: config.llm.geminiSearchModel,
            contents: `Search the web and provide a clear, factual answer for: ${query}`,
            config: {
                thinkingConfig: {
                    thinkingBudget: 0,
                },
            },
        }, config.search.timeoutMs));
    return response.text;
}

async function searchWithTavily(query) {
    if (!config.search.tavilyApiKey) {
        throw new Error("TAVILY_API_KEY not configured in .env");
    }

    const tvly = tavily({ apiKey: config.search.tavilyApiKey });
    const response = await tvly.search(query, { max_results: config.search.tavilyMaxResults });
    const result = response.results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
        .join("\n\n");

    if (!result) throw new Error("No Tavily result found!");

    return result;
}

async function searchWithGroq(query) {
    const groqSearchModel = new ChatGroq({
        model: config.llm.primaryModel,
        apiKey: config.llm.groqApiKey,
        temperature: config.llm.searchFallbackTemperature,
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

// const res = await webSearchTool.invoke({ query: "score of real madrid vs barcelone" });
// console.log(res);
