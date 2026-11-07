const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const voiceBtn = document.getElementById("voice-btn");
const newChatBtn = document.getElementById("new-chat-btn");

let sessionId = localStorage.getItem("chat_session_id");
if (!sessionId) {
    sessionId = "session-" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("chat_session_id", sessionId);
}

marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
});

userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event("submit"));
    }
});

newChatBtn.addEventListener("click", () => {
    sessionId = "session-" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("chat_session_id", sessionId);
    chatMessages.innerHTML = `
        <div class="message-row assistant">
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                <p>New conversation started. How can I help you today?</p>
            </div>
        </div>
    `;
});

async function loadChatHistory() {
    try {
        const res = await fetch(`api/history/${sessionId}`);
        const data = await res.json();

        if (data.messages && data.messages.length > 0) {
            chatMessages.innerHTML = ""; // Clear welcome banner
            data.messages.forEach(msg => {
                appendMessage(msg.role, msg.content);
            });
        }
        if (data.pendingInterrupt) {
            const assistantContent = appendMessage("assistant", "");
            renderApprovalCard(data.pendingInterrupt, assistantContent);
        }
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}

function appendMessage(role, text = "") {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const icon = role === "user" ? "fa-solid fa-user" : "fa-solid fa-robot";
    row.innerHTML = `
        <div class="avatar"><i class="${icon}"></i></div>
        <div class="message-content"></div>
    `;

    const contentDiv = row.querySelector(".message-content");
    if (text) {
        contentDiv.innerHTML = marked.parse(text);
        attachCopyButtons(contentDiv);
    }

    chatMessages.appendChild(row);
    scrollToBottom();
    return contentDiv;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function attachCopyButtons(container) {
    container.querySelectorAll("pre").forEach((pre) => {
        if (pre.parentElement.classList.contains("code-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.className = "code-wrapper";
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const copyBtn = document.createElement("button");
        copyBtn.className = "code-copy-btn";
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.onclick = () => {
            const code = pre.querySelector("code")?.innerText || pre.innerText;
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                }, 2000);
            });
        };
        wrapper.appendChild(copyBtn);
    });
}

setupVoiceInput(voiceBtn, (transcript) => {
    userInput.value = transcript;
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
});

function renderApprovalCard(payload, assistantContent) {
    const card = document.createElement("div");
    card.className = "approval-card";
    card.innerHTML = `
        <div class="approval-header">
            <i class="fa-solid fa-shield-halved"></i>
            <span>Human Approval Required</span>
            <span class="approval-badge">${payload.action_type || "action"}</span>
        </div>
        <div class="approval-title">${payload.title || "Action Request"}</div>
        <div class="approval-details">${payload.details || ""}</div>
        <div class="approval-summary">${payload.summary || "Do you approve this action?"}</div>
        <div class="approval-actions">
            <button type="button" class="btn-approve">
                <i class="fa-solid fa-check"></i> Approve
            </button>
            <button type="button" class="btn-reject">
                <i class="fa-solid fa-xmark"></i> Reject
            </button>
        </div>
    `;

    assistantContent.innerHTML = "";
    assistantContent.appendChild(card);
    scrollToBottom();

    const approveBtn = card.querySelector(".btn-approve");
    const rejectBtn = card.querySelector(".btn-reject");

    const handleDecision = async (decision) => {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        card.querySelector(".approval-actions").innerHTML = `<span class="approval-status">${decision === "approve" ? "✅ Approved — Processing..." : "❌ Rejected — Cancelling..."
            }</span>`;

        await streamResponse("api/chat/resume", { decision, sessionId }, assistantContent);
    };

    approveBtn.onclick = () => handleDecision("approve");
    rejectBtn.onclick = () => handleDecision("reject");
}

async function streamResponse(endpoint, bodyPayload, assistantContent) {
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
            assistantContent.innerHTML = `<span style="color:#ef4444">Error: ${response.statusText}</span>`;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let toolPill = null;
        let clearedInitialPlaceholder = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.replace("data: ", "").trim();
                if (!jsonStr) continue;

                try {
                    const data = JSON.parse(jsonStr);

                    if (!clearedInitialPlaceholder && (data.type === "tool_start" || data.type === "token" || data.type === "interrupt")) {
                        assistantContent.innerHTML = "";
                        clearedInitialPlaceholder = true;
                    }

                    if (data.type === "interrupt") {
                        renderApprovalCard(data.payload, assistantContent);
                    } else if (data.type === "tool_start") {
                        const toolMeta = getToolMeta(data.tool);
                        if (!toolPill) {
                            toolPill = document.createElement("div");
                            toolPill.className = "tool-status-pill";
                            assistantContent.appendChild(toolPill);
                        }
                        toolPill.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Querying ${toolMeta.label}...`;
                        scrollToBottom();
                    } else if (data.type === "tool_end") {
                        const toolMeta = getToolMeta(data.tool);
                        if (toolPill) {
                            toolPill.classList.add("completed");
                            toolPill.innerHTML = `<i class="fa-solid fa-check"></i> Consulted ${toolMeta.label}`;
                        }
                    } else if (data.type === "token") {
                        const tokenChunk = data.content ?? data.token ?? "";
                        fullText += tokenChunk;

                        const rendered = marked.parse(fullText);
                        if (toolPill) {
                            assistantContent.innerHTML = "";
                            assistantContent.appendChild(toolPill);
                            const textSpan = document.createElement("div");
                            textSpan.innerHTML = rendered;
                            assistantContent.appendChild(textSpan);
                        } else {
                            assistantContent.innerHTML = rendered;
                        }
                        attachCopyButtons(assistantContent);
                        scrollToBottom();
                    } else if (data.type === "error") {
                        assistantContent.innerHTML += `<div style="color: #ef4444; margin-top: 0.5rem;">[Error: ${data.error || data.message}]</div>`;
                    }
                } catch (err) {
                    // Ignore SSE json chunk boundary splits
                }
            }
        }
    } catch (err) {
        assistantContent.innerHTML = `<span style="color:#ef4444">Connection failed: ${err.message}</span>`;
    }
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    userInput.value = "";
    userInput.style.height = "auto";

    appendMessage("user", query);

    const assistantContent = appendMessage("assistant", "");
    assistantContent.innerHTML = `<em>Thinking...</em>`;

    await streamResponse("api/chat", { message: query, sessionId }, assistantContent);
});

loadChatHistory();
