import { MongoClient } from "mongodb";
import { config } from "../config/index.js";

let client = null;
let db = null;

export async function getClient() {
    if (!client) {
        client = new MongoClient(config.db.uri);
        await client.connect();
    }

    return client;
}

export async function getDb() {
    const client = await getClient();
    return client.db(config.db.name);
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