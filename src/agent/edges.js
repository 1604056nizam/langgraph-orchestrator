//conditional edges
//router -> selected capability

export function routeDecisionEdge(state) {
    switch (state.current_capability) {
        case "direct":
            return "direct";
        case "web_search":
            return "web_search";
        case "vectorstore":
            return "vectorstore";
        default:
            return "direct";
    }
}

// crag evaluator -> generate/rewrite

export function cragDecisionEdge(state) {
    if (state.evaluation_status === "READY_TO_GENERATE") {
        return "generate";
    }

    return "rewrite";
}