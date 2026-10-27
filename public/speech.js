function setupVoiceInput(buttonElement, onResult) {
    if (!buttonElement) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        buttonElement.style.display = "none";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let isRecording = false;

    buttonElement.addEventListener("click", () => {
        if (!isRecording) {
            recognition.start();
            buttonElement.classList.add("recording");
            isRecording = true;
        } else {
            recognition.stop();
            buttonElement.classList.remove("recording");
            isRecording = false;
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (onResult) {
            onResult(transcript);
        }
        buttonElement.classList.remove("recording");
        isRecording = false;
    };

    recognition.onerror = () => {
        buttonElement.classList.remove("recording");
        isRecording = false;
    };

    recognition.onend = () => {
        buttonElement.classList.remove("recording");
        isRecording = false;
    };
}

