const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const voiceBtn = document.getElementById("voice-btn");
const newChatBtn = document.getElementById("new-chat-btn");


let sessionId = "session-" + Math.random().toString(36).substring(2, 9);

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
    chatMessages.innerHTML = `
        <div class="message-row assistant">
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                <p>New conversation started. How can I help you today?</p>
            </div>
        </div>
    `;
});


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

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = userInput.value.trim();
    if (!query) return;

    userInput.value = "";
    userInput.style.height = "auto";

    appendMessage("user", query);

    const assistantContent = appendMessage("assistant", "");
    assistantContent.innerHTML = `<em>Thinking...</em>`;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: query, sessionId })
        });

        if (!response.ok) {
            assistantContent.innerHTML = `<span style="color:#ef4444">Error: ${response.statusText}</span>`;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let toolPill = null;
        assistantContent.innerHTML = "";

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

                    if (data.type === "tool_start") {
                        if (!toolPill) {
                            toolPill = document.createElement("div");
                            toolPill.className = "tool-status-pill";
                            assistantContent.appendChild(toolPill);
                        }
                        const toolLabel = data.tool === "search_internal_documents" ? "MongoDB Vector Docs" : "Live Web Search";
                        toolPill.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Querying ${toolLabel}...`;
                        scrollToBottom();
                    } else if (data.type === "tool_end") {
                        if (toolPill) {
                            toolPill.classList.add("completed");
                            const toolLabel = data.tool === "search_internal_documents" ? "MongoDB Vector Docs" : "Live Web Search";
                            toolPill.innerHTML = `<i class="fa-solid fa-check"></i> Consulted ${toolLabel}`;
                        }
                    } else if (data.type === "token") {
                        const tokenChunk = data.content ?? data.token ?? "";
                        fullText += tokenChunk;

                        // Render streaming markdown
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
                        assistantContent.innerHTML += `<div style="color: #ef4444; margin-top: 0.5rem;">[Error: ${data.message}]</div>`;
                    }
                } catch (err) {
                    // Ignore SSE json chunk boundary splits
                }
            }
        }
    } catch (err) {
        assistantContent.innerHTML = `<span style="color:#ef4444">Connection failed: ${err.message}</span>`;
    }
});

// Web Speech API: Voice-To-Text (Microphone)
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let isRecording = false;

    voiceBtn.addEventListener("click", () => {
        if (!isRecording) {
            recognition.start();
            voiceBtn.classList.add("recording");
            isRecording = true;
        } else {
            recognition.stop();
            voiceBtn.classList.remove("recording");
            isRecording = false;
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        userInput.style.height = "auto";
        userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
        voiceBtn.classList.remove("recording");
        isRecording = false;
    };

    recognition.onerror = () => {
        voiceBtn.classList.remove("recording");
        isRecording = false;
    };

    recognition.onend = () => {
        voiceBtn.classList.remove("recording");
        isRecording = false;
    };
} else {
    // Hide microphone button if browser doesn't support Web Speech API
    voiceBtn.style.display = "none";
}

