const TOOL_DEFINITIONS = {
    search_internal_documents: {
        label: "MongoDB Vector Docs",
        icon: "fa-database"
    },
    web_search: {
        label: "Live Web Search",
        icon: "fa-globe"
    }
};

function getToolMeta(toolName) {
    return TOOL_DEFINITIONS[toolName] || {
        label: toolName || "External Tool",
        icon: "fa-gear"
    };
}

