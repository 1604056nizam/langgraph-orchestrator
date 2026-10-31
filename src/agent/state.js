import { Annotation, messagesStateReducer } from "@langchain/langgraph";

export const GraphState = Annotation.Root({
    messages: Annotation({
        reducer: messagesStateReducer,
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
    }),
    conversation_summary: Annotation({
        reducer: (prev, next) => next ?? prev,
        default: () => ""
    })
});