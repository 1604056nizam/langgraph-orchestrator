import { getClient, getDb } from "./connection.js";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

const client = await getClient();
const db = await getDb();

export const checkpointer = new MongoDBSaver({
    client,
    dbName: db.databaseName
});
