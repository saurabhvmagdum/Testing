require("dotenv").config();
const { Pinecone } = require("@pinecone-database/pinecone");
const { HfInference } = require("@huggingface/inference");

class VectorDatabase {
  constructor(apiKey, pineconeApiKey, pineconeEnvironment) {
    if (!apiKey || !pineconeApiKey || !pineconeEnvironment) {
      throw new Error("API keys and environment are required to initialize VectorDatabase.");
    }

    // Initialize Hugging Face client
    this.embeddingClient = new HfInference(apiKey);

    // Initialize Pinecone properties
    this.pineconeClient = null;
    this.pineconeApiKey = pineconeApiKey;
    this.pineconeEnvironment = pineconeEnvironment;
    this.collectionName = "research-articles"; // Changed from "researchguy"
    this.batchSize = 100;
    this.index = null;
    
    // Get host URL from environment
    const pineconeHost = process.env.PINECONE_HOST;
    if (!pineconeHost) {
      throw new Error("Pinecone host URL is required");
    }
    this.controllerHostUrl = pineconeHost;
  }

  async initialize() {
    try {
      this.pineconeClient = new Pinecone({
        apiKey: this.pineconeApiKey,
        controllerHostUrl: this.controllerHostUrl
      });

      // Check if index exists
      const indexes = await this.pineconeClient.listIndexes();
      console.log('Available indexes:', indexes);

      if (!indexes.includes(this.collectionName)) {
        console.log(`Index ${this.collectionName} not found. Creating new index...`);
        await this.createCollection();
        // Wait for index to be ready
        await this.waitForIndex();
      }

      // Get index after ensuring it exists
      this.index = this.pineconeClient.index('research-articles');
      
      // Verify connection
      const indexDescription = await this.pineconeClient.describeIndex(this.collectionName);
      console.log("Pinecone Connection Successful. Index Description:", {
        name: indexDescription.name,
        dimension: indexDescription.dimension,
        metric: indexDescription.metric,
        status: indexDescription.status
      });
      
      return true;
    } catch (error) {
      console.error("Error initializing Pinecone client:", error);
      throw error;
    }
  }

  async waitForIndex(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const indexDescription = await this.pineconeClient.describeIndex(this.collectionName);
        if (indexDescription.status?.ready) {
          console.log('Index is ready');
          return true;
        }
        console.log('Waiting for index to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      } catch (error) {
        console.log('Error checking index status:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    throw new Error('Index failed to become ready in time');
  }

  async createCollection() {
    try {
      await this.pineconeClient.createIndex({
        name: this.collectionName,
        dimension: 1024,
        metric: "cosine",
      });
      console.log(`Pinecone index "${this.collectionName}" creation initiated.`);
    } catch (error) {
      console.error("Error creating Pinecone index:", error.message);
      throw error;
    }
  }

  async addDocuments(documents) {
    try {
      if (!this.index) {
        throw new Error("Pinecone index not initialized");
      }

      if (!Array.isArray(documents)) {
        throw new Error('Documents must be an array');
      }

      // Process in batches
      for (let i = 0; i < documents.length; i += this.batchSize) {
        const batch = documents.slice(i, i + this.batchSize);
        const embeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        
        const upsertData = embeddings.map((embedding, idx) => ({
          id: `${Date.now()}-${i + idx}`,
          values: embedding,
          metadata: { text: batch[idx] },
        }));

        // Updated upsert syntax
        await this.index.upsert({
          vectors: upsertData
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
      if (!this.index) {
        throw new Error("Pinecone index not initialized");
      }

      const queryEmbedding = await this.generateEmbedding(query);

      // Updated query syntax
      const queryResponse = await this.index.query({
        vector: queryEmbedding,
        topK: k,
        includeMetadata: true
      });

      return queryResponse.matches.map((match) => ({
        document: match.metadata.text,
        score: match.score,
      }));
    } catch (error) {
      console.error("Error performing similarity search:", error.message);
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
    // Pinecone does not require explicit connection closing.
    console.log("Pinecone connection is managed automatically.");
  }
}

module.exports = { VectorDatabase };