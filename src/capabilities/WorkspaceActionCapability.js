import { z } from "zod";
import { BaseCapability } from "./BaseCapability.js";
import { getCollection } from "../db/connection.js";
import { config } from "../config/index.js";

const ActionProposalSchema = z.object({
    action_type: z.string()
        .describe("Short snake_case category of the action (e.g., 'reimbursement', 'booking', 'order', 'support_ticket', 'submission')"),
    title: z.string()
        .describe("Short human-readable title of the requested action"),
    summary: z.string()
        .describe("Polite 1-sentence confirmation question asking the user to approve this action"),
    details: z.string()
        .describe("All key extracted parameters (items, amounts, dates, quantities, or descriptions)")
});

export class WorkspaceActionCapability extends BaseCapability {
    constructor(model) {
        super(
            "workspace_action",
            "Action & Request Submission",
            "Use this ONLY when the user wants to SUBMIT, FILE, BOOK, ORDER, SCHEDULE, or CREATE an official action, request, booking, or record. Do NOT use this when the user is just asking an informational question.",
            "action",
            false
        );
        this.structuredModel = model.withStructuredOutput(ActionProposalSchema);
    }

    async execute(query) {
        const prompt = `Extract a structured action proposal from the user's request so the human can review and approve it before execution.\n\nUser Request: "${query}"`;
        const proposal = await this.structuredModel.invoke(prompt);
        return proposal;
    }

    async commit(actionProposal) {
        const collection = await getCollection(config.db.collections.workspaceActions);
        const referenceId = `ACT-${Math.floor(100000 + Math.random() * 900000)}`;

        const record = {
            referenceId,
            ...actionProposal,
            status: "APPROVED",
            createdAt: new Date().toISOString()
        };

        await collection.insertOne(record);

        return `Action officially APPROVED and recorded in the database!\n- Reference ID: ${referenceId}\n- Type: ${actionProposal.action_type}\n- Title: ${actionProposal.title}\n- Details: ${actionProposal.details}`;
    }
}