import { config } from "../config/index.js";

// Post-execution lifecycle router (zero hardcoded capability names!)

export function postCapabilityEdge(state) {
    switch (state.evaluation_status) {
        case "COMPLETED":
            return shouldSummarizeEdge(state);
        case "NEEDS_EVALUATION":
            return "evaluate";
        case "READY_TO_GENERATE":
        default:
            return "generate";
    }
}

// crag evaluator -> generate/rewrite

export function cragDecisionEdge(state) {
    if (state.evaluation_status === "READY_TO_GENERATE") {
        return "generate";
    }

    return "rewrite";
}

export function shouldSummarizeEdge(state) {
    if (state.messages.length > config.memory.maxMessagesBeforeSummary) {
        return "summarize";
    }
    return "end";
}