export class RetryPolicy {
    constructor(defaultMaxRetries = 2) {
        this.defaultMaxRetries = defaultMaxRetries;
    }

    evaluateNextStep(state, evaluation, registry = null) {
        const currentCap = state.current_capability;
        const attempts = { ...state.attempts_per_capability };
        const currentCount = (attempts[currentCap] || 0) + 1;
        attempts[currentCap] = currentCount;

        if (evaluation.grade === "CORRECT") {
            return {
                status: "READY_TO_GENERATE",
                attempts_per_capability: attempts,
                excluded_capabilities: state.excluded_capabilities
            };
        }

        const capabilityObj = registry?.get(currentCap);
        const maxAllowed = capabilityObj?.maxRetries ?? this.defaultMaxRetries;

        if (currentCount >= maxAllowed) {
            console.log(`Capability '${currentCap}' reached max retries (${currentCount}/${maxAllowed}). DYNAMICALLY EXCLUDING it!`);
            return {
                status: "EXCLUDE_AND_RE_ROUTE",
                attempts_per_capability: attempts,
                excluded_capabilities: [...state.excluded_capabilities, currentCap]
            };
        }

        console.log(`Capability '${currentCap}' attempt ${currentCount}/${maxAllowed}. Will retry with new query.`);
        return {
            status: "RETRY_CURRENT",
            attempts_per_capability: attempts,
            excluded_capabilities: state.excluded_capabilities
        };

    }
}