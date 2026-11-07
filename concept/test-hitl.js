import { StateGraph, Annotation, START, END, interrupt, Command, MemorySaver } from "@langchain/langgraph";

const ExpenseState = Annotation.Root({
    item: Annotation(),
    amount: Annotation(),
    status: Annotation()
});

async function approvalNode(state) {
    console.log("--> [Node Start] Entering approvalNode...");

    const humanDecision = interrupt({
        question: `Do you approve buying '${state.item}' for $${state.amount}?`,
        item: state.item,
        amount: state.amount
    });

    console.log("--> [Node Resumed] Human decided:", humanDecision);

    if (humanDecision == "approve") {
        return { status: `APPROVED: Purchased ${state.item} ($${state.amount})` };
    } else {
        return { status: `REJECTED: Cancelled ${state.item}` };
    }

}

const checkpointer = new MemorySaver();

const app = new StateGraph(ExpenseState)
    .addNode("approval", approvalNode)
    .addEdge(START, "approval")
    .addEdge("approval", END)
    .compile({ checkpointer });


const threadConfig = { configurable: { thread_id: "demo-thread-1" } };
console.log("=== RUN 1: Starting Graph ===");

await app.invoke({ item: "Standing Desk", amount: 450, status: "PENDING" }, threadConfig);

const snapshot = await app.getState(threadConfig);
console.log("Paused at node:", snapshot.next);
console.log("Interrupt payload for UI:", snapshot.tasks[0]?.interrupts[0]?.value);
console.log("Current status in state:", snapshot.values.status);


console.log("\n=== RUN 2: Resuming with Human Decision ===");
const finalState = await app.invoke(new Command({ resume: "approve" }), threadConfig);

console.log("Final status:", finalState.status);
const afterSnapshot = await app.getState(threadConfig);
console.log("Paused at node now:", afterSnapshot.next);