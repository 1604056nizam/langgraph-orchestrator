export function dotProduct(vecA, vecB) {
    return vecA.reduce((sum, val, idx) => sum + val * vecB[idx], 0);
}

export function magnitude(vec) {
    return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

export function cosineSimilarity(vecA, vecB) {
    return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}