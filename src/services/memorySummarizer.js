export class MemorySummarizer {
    constructor(llm) {
        this.llm = llm;
    }

    async summarize(existingSummary, messageToSummarize) {
        const transcript = messageToSummarize.map((msg) => {
            const speaker = msg._getType() === "human" ? "User" : "Assistant";
            const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
            return `${speaker}: ${content}`;
        }).join("\n");

        const prompt = existingSummary ? `You maintain a concise running memory of a conversation.
        Existing Summary:
        "${existingSummary}"
        New Conversation Turns to Fold In:
        ${transcript}
        Update the summary to preserve key user facts (names, preferences, roles), topics discussed, and important conclusions in 4-6 concise bullet points. Output ONLY the updated summary.`
            : `Summarize the following conversation turns concisely in 4-6 bullet points, preserving key user facts (names, preferences, roles), topics discussed, and important conclusions. Output ONLY the summary:
        ${transcript}`;

        const response = await this.llm.invoke(prompt);
        return typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);
    }
}