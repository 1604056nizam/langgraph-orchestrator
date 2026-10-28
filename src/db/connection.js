import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

let client = null;
let db = null;

const DB_NAME = "chatbot_db";

export async function getClient() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
    }

    return client;
}

export async function getDb() {
    const client = await getClient();
    return client.db(DB_NAME);
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