import { config } from "../config/index.js";
import { getCollection, getDb } from "./connection.js";

export class VectorStoreRepository {
    constructor({
        collectionName = config.db.collections.knowledgeChunks,
        indexName = config.db.vectorIndexName,
        dimensions = config.llm.embeddingDimensions
    } = {}) {

        this.collectionName = collectionName;
        this.indexName = indexName;
        this.dimensions = dimensions;
    }

    async getCollection() {
        return await getCollection(this.collectionName);
    }

    async replaceAllChunks(chunks) {
        const db = await getDb();
        await db.createCollection(this.collectionName).catch(() => { });
        const collection = await this.getCollection();

        await collection.deleteMany({});
        if (chunks.length > 0) {
            await collection.insertMany(chunks);
        }
    }

    async ensureVectorIndex() {
        const collection = await this.getCollection();
        const existing = await collection.listSearchIndexes(this.indexName).toArray();

        if (existing.length === 0) {
            console.log(`Creating HNSW vector index '${this.indexName}' (${this.dimensions} dims)...`);
            await collection.createSearchIndex({
                name: this.indexName,
                type: "vectorSearch",
                definition: {
                    fields: [
                        {
                            type: "vector",
                            path: "vector",
                            numDimensions: this.dimensions,
                            similarity: "cosine"
                        }
                    ]
                }
            });
        }
        for (let i = 0; i < 30; i++) {
            const [idx] = await collection.listSearchIndexes(this.indexName).toArray();
            if (idx?.queryable) {
                console.log(`Vector index '${this.indexName}' is READY.`);
                return;
            }
            await new Promise((r) => setTimeout(r, 1000));
        }

        throw new Error(`Timed out waiting for vector index '${this.indexName}' to become queryable.`);
    }

    async search(queryVector, { limit = config.rag.topK, minScore = config.rag.minSimilarityScore } = {}) {
        const collection = await this.getCollection();
        const pipeline = [
            {
                $vectorSearch: {
                    index: this.indexName,
                    path: "vector",
                    queryVector,
                    numCandidates: limit * 10,
                    limit
                }
            },
            {
                $project: {
                    _id: 0,
                    text: 1,
                    source: 1,
                    chunkIndex: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            },
            {
                $match: {
                    score: { $gte: minScore }
                }
            }
        ];

        return await collection.aggregate(pipeline).toArray();
    }
}

export const vectorStore = new VectorStoreRepository();