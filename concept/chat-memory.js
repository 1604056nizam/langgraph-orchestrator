import dotenv from "dotenv";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

dotenv.config({ path: "../.env" });

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
})

const history = new InMemoryChatMessageHistory();

const promt = ChatPromptTemplate.fromMessages([
    ["system", "You are a learned person who knows everything"],
    new MessagesPlaceholder("history"),
    ["human", "{question}"],
]);

const chain = promt.pipe(model).pipe(new StringOutputParser());


async function ask(question) {
    const response = await chain.invoke({
        "history": await history.getMessages(),
        "question": question,
    })

    await history.addUserMessage(question);
    await history.addAIMessage(response);

    console.log(`User: ${question}`);
    console.log(`AI: ${response}`);
}


await ask("My name is Nizam, and my favourite color is blue");
await ask("What is my name and what is my favourite color?");