require("dotenv").config();
const { PineconeClient } = require("@pinecone-database/pinecone"); // Pinecone SDK for Node.js
const { HfInference } = require("@huggingface/inference"); // Hugging Face library for embeddings

class VectorDatabase {
  constructor(apiKey, pineconeApiKey, pineconeEnvironment) {
    if (!apiKey || !pineconeApiKey || !pineconeEnvironment) {
      throw new Error("API keys and environment are required to initialize VectorDatabase.");
    }

    // Initialize Hugging Face Inference for embeddings
    this.embeddingClient = new HfInference(apiKey);

    // Initialize Pinecone client
    this.pineconeClient = null;
    this.pineconeApiKey = pineconeApiKey;
    this.pineconeEnvironment = pineconeEnvironment;
    this.collectionName = "documents"; // Use this as the Pinecone namespace
  }

  async initialize() {
    try {
      // Create a new Pinecone client
      this.pineconeClient = await PineconeClient.init({
        apiKey: this.pineconeApiKey,
        environment: this.pineconeEnvironment,
      });
      console.log("Pinecone client initialized successfully");
    } catch (error) {
      console.error("Error initializing Pinecone client:", error.message);
      throw error;
    }
  }

  async createCollection() {
    try {
      if (!this.pineconeClient) {
        throw new Error("Pinecone client not initialized. Call initialize() first.");
      }
      // Create a new index in Pinecone (namespace)
      const index = await this.pineconeClient.createIndex({
        name: this.collectionName,
        dimension: 768, // Embedding size for the model you are using (e.g., MiniLM)
        metric: "cosine", // Use cosine similarity
      });
      console.log(`Pinecone collection "${this.collectionName}" created.`);
    } catch (error) {
      console.error("Error creating Pinecone collection:", error.message);
      throw error;
    }
  }

  async addDocuments(documents) {
    try {
      if (!this.pineconeClient) {
        throw new Error("Pinecone client not initialized. Call initialize() first.");
      }

      // Generate embeddings for all documents
      const embeddings = await Promise.all(
        documents.map(async (text) => ({
          embedding: await this.generateEmbedding(text),
          text,
        }))
      );

      // Prepare Pinecone upsert data
      const upsertData = embeddings.map(({ embedding, text }, idx) => ({
        id: idx.toString(), // Use string IDs for Pinecone
        values: embedding, // The vector
        metadata: { text }, // Optional metadata (e.g., original document text)
      }));

      // Get the index instance
      const index = this.pineconeClient.Index(this.collectionName);

      // Upsert data to Pinecone
      await index.upsert({
        upsertRequest: {
          vectors: upsertData,
          namespace: this.collectionName,
        }
      });

      console.log(`Added ${documents.length} documents to Pinecone.`);
    } catch (error) {
      console.error("Error adding documents to Pinecone:", error.message);
      throw error;
    }
  }

  async similaritySearch(query, k = 5) {
    try {
      if (!this.pineconeClient) {
        throw new Error("Pinecone client not initialized. Call initialize() first.");
      }

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Get the index instance
      const index = this.pineconeClient.Index(this.collectionName);

      // Perform similarity search
      const queryResult = await index.query({
        queryRequest: {
          vector: queryEmbedding,
          topK: k,
          includeMetadata: true,
          namespace: this.collectionName,
        }
      });

      // Map results to an array
      return queryResult.matches.map((match) => ({
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