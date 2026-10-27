import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { AsyncBatchedStore } from "@langchain/langgraph";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

let client = null;
let db = null;

const DB_NAME = "chatbot_db";

export async function getDb() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log("connected to DB");
    }

    return db;
}

export async function getCollection(collectionName) {
    const db = await getDb();
    return db.collection(collectionName);
}

export async function closeDb(params) {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}