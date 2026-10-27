import { ChatGroq } from "@langchain/groq";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import "dotenv/config";

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
})

const history = new InMemoryChatMessageHistory();
await history.addUserMessage("Hi, my name is Nizam");
await history.addAIMessage("Hello, Nizam! How can I assist you today?");
const allMessages = await history.getMessages();
console.log(allMessages);


const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an expert tutor in {subject}. Answer in 2 concise sentences."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{question}"],
])

const parser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(parser);

const result = await chain.stream({
    subject: "History",
    question: "How did Bangladesh got independence?",
})

for await (const chunk of result) {
    process.stdout.write(chunk);
}