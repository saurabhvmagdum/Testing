require("dotenv").config();
const { QdrantClient } = require("@qdrant/js-client-rest");
const { HfInference } = require("@huggingface/inference");

class VectorDatabase {
  constructor(apiKey, qdrantUrl, qdrantApiKey) {
    if (!apiKey || !qdrantUrl) {
      throw new Error("API keys and Qdrant URL are required.");
    }

    // Initialize Hugging Face client
    this.embeddingClient = new HfInference(apiKey);

    // Initialize Qdrant client
    this.qdrantClient = new QdrantClient({ 
      url: qdrantUrl,
      apiKey: qdrantApiKey
    });

    this.collectionName = "research-articles";
    this.vectorSize = 1024;
    this.batchSize = 100;
  }

  async initialize() {
    try {
      // Check if collection exists
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        console.log(`Collection ${this.collectionName} not found. Creating new collection...`);
        await this.createCollection();
      }

      // Verify collection is ready
      const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
      console.log("Qdrant Connection Successful. Collection Info:", collectionInfo);
      
      return true;
    } catch (error) {
      console.error("Error initializing Qdrant client:", error);
      throw error;
    }
  }

  async createCollection() {
    try {
      await this.qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: "Cosine"
        }
      });
      console.log(`Qdrant collection "${this.collectionName}" created.`);
    } catch (error) {
      console.error("Error creating Qdrant collection:", error);
      throw error;
    }
  }

  async addDocuments(documents) {
    try {
      if (!Array.isArray(documents)) {
        throw new Error('Documents must be an array');
      }

      // Process in batches
      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batch = documents.slice(i, i + this.batchSize);
        const embeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        
        const points = embeddings.map((embedding, idx) => ({
          id: Date.now() + idx,
          vector: embedding,
          payload: { text: batch[idx] }
        }));

        await this.qdrantClient.upsert(this.collectionName, {
          points: points
        });
      }

      return true;
    } catch (error) {
      console.error("Error in batch processing:", error);
      throw error;
    }
  }

  async similaritySearch(query, k = 5) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const results = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit: k
      });

      return results.map(match => ({
        document: match.payload.text,
        score: match.score
      }));
    } catch (error) {
      console.error("Error performing similarity search:", error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.embeddingClient.featureExtraction({
        inputs: text,
        model: "sentence-transformers/all-MiniLM-L6-v2",
      });

      if (!response || !Array.isArray(response)) {
        throw new Error("Failed to generate embedding.");
      }

      return response; // The embedding vector
    } catch (error) {
      console.error("Error generating embedding:", error.message);
      throw error;
    }
  }

  async closeConnection() {
    // Qdrant does not require explicit connection closing.
    console.log("Qdrant connection is managed automatically.");
  }
}

module.exports = { VectorDatabase };