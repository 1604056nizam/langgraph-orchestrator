import { z } from "zod";
const grade = ["CORRECT", "INCORRECT", "AMBIGUOUS"];

const EvaluationSchema = z.object({
    confidence: z.number().min(0).max(1).describe(`Confidence score between 0.0 and 1.0`),
    grade: z.enum(grade).describe(`'CORRECT': The document clearly and directly answers the question. " +
        "'AMBIGUOUS': The document is partially relevant or related, but lacks complete details to fully answer. " +
        "'INCORRECT': The document is irrelevant, tangential, or does not address the question at all.`),
    reason: z.string().describe("1-2 sentence explaining for the grade")
});


export class CRAGEvaluator {
    constructor(llm) {
        this.structuredEvaluator = llm.withStructuredOutput(EvaluationSchema);
    }

    async evaluate(query, documentContext) {
        const prompt = `You are an impartial grader evaluating whether a retrieved document context is relevant and sufficient to answer a user's question.
        User Question: "${query}"
        Retrieved Context: """${documentContext || "[NO CONTEXT RETRIEVED]"}"""
        Evaluate the relevance and completeness of the retrieved context.`;


        return await this.structuredEvaluator.invoke(prompt);
    }
}