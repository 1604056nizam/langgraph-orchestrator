import { z } from "zod";

const ContextualizedQuerySchema = z.object({
    standalone_query: z.string().describe("A self-contained version of the user's latest message with pronouns/references resolved using chat history, OR the exact original message if it is already standalone, a greeting, or a topic change."),
    was_contextualized: z.boolean().describe("True if pronouns or implicit context were expanded; false if kept as-is.")
});

export class QueryContextualizer {
    constructor(llm) {
        this.structuredLlm = llm.withStructuredOutput(ContextualizedQuerySchema);
    }

    async contextualize(latestQuery, recentHistoryText, summary = "") {
        const prompt = `You are a conversation contextualizer. Given a conversation summary, recent turns, and the user's latest message, reformulate the latest message into a standalone query ONLY IF it depends on prior context (e.g., uses pronouns like "it", "that", "they", "there", or asks a follow-up fragment like "what about part-time?").
        Rules:
        - Do NOT answer the question.
        - Keep first-person pronouns ("my", "me", "I") UNCHANGED when the user asks about themselves or earlier parts of the conversation.
        - If the latest message is already self-contained, a greeting/acknowledgment ("thanks", "hi"), or switches to a new topic, return it UNCHANGED.
        ${summary ? `Conversation Summary:\n${summary}\n` : ""}
        Recent Conversation:
        ${recentHistoryText}
        Latest User Message: "${latestQuery}"`;

        return await this.structuredLlm.invoke(prompt);
    }
}