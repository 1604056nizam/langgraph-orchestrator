import { Annotation } from "@langchain/langgraph";

export const GraphState = Annotation.Root({
    messages: Annotation({
        reducer: (prev, next) => prev.concat(next),
        default: () => []
    }),
    current_query: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    current_capability: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    attempts_per_capability: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ({})
    }),
    excluded_capabilities: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => []
    }),
    retrieved_context: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    evaluation_status: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    }),
    evaluation_reason: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    })
});