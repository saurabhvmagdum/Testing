require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("winston");

// Configure winston logger
logger.configure({
  transports: [
    new logger.transports.Console({
      format: logger.format.combine(
        logger.format.colorize(),
        logger.format.simple()
      )
    })
  ]
});

class RAGSystem {
  constructor(apiKey) {
    // If apiKey is not provided, get it from environment variables
    if (!apiKey && !process.env.GEMINI_API_KEY) {
      throw new Error("API key is required to initialize RAGSystem.");
    }

    this.apiKey = apiKey || process.env.GEMINI_API_KEY;

    try {
      // Initialize the Google Generative AI client
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Get the model
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-pro",
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 50,
          maxOutputTokens: 150,
        }
      });

      logger.info("Gemini model initialized successfully.");
    } catch (error) {
      logger.error(`Error initializing the Gemini model: ${error.message}`);
      throw error;
    }
  }

  async generateResponse(prompt) {
    /**
     * Generates a response for the given prompt using the Gemini API.
     * @param {string} prompt - The input prompt for generating content.
     * @returns {string} The generated response text.
     */
    try {
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('Invalid prompt provided');
      }

      // Generate content
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('No response text received from the Gemini model');
      }

      return text.trim();
    } catch (error) {
      logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }

  async generateStreamResponse(prompt) {
    /**
     * Generates a streaming response for the given prompt using the Gemini API.
     * @param {string} prompt - The input prompt for generating content.
     * @returns {AsyncGenerator} A generator that yields response chunks.
     */
    try {
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('Invalid prompt provided');
      }

      // Generate streaming content
      const result = await this.model.generateContentStream(prompt);
      
      return result;
    } catch (error) {
      logger.error(`Error generating streaming response: ${error.message}`);
      throw error;
    }
  }

  async generateStructuredResponse(prompt, responseFormat = {}) {
    /**
     * Generates a structured response based on the provided format.
     * @param {string} prompt - The input prompt for generating content.
     * @param {Object} responseFormat - Desired structure of the response.
     * @returns {Object} Structured response object.
     */
    try {
      // Add structure requirements to the prompt
      const structuredPrompt = `
        Please provide a response in the following structured format:
        ${JSON.stringify(responseFormat, null, 2)}
        
        Prompt: ${prompt}
      `;

      const response = await this.generateResponse(structuredPrompt);
      
      // You might want to add parsing logic here depending on your needs
      return response;
    } catch (error) {
      logger.error(`Error generating structured response: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { RAGSystem };

// Example Usage
async function example() {
  try {
    const ragSystem = new RAGSystem(); // Will use GEMINI_API_KEY from .env
    
    // Simple response
    console.log("\nGenerating simple response:");
    const response1 = await ragSystem.generateResponse(
      "What are the benefits of artificial intelligence?"
    );
    console.log(response1);

    // Streaming response
    console.log("\nGenerating streaming response:");
    const stream = await ragSystem.generateStreamResponse(
      "List 5 interesting facts about space exploration."
    );
    for await (const chunk of stream) {
      const chunkText = chunk.text();
      console.log(chunkText);
    }

    // Structured response
    console.log("\nGenerating structured response:");
    const structuredResponse = await ragSystem.generateStructuredResponse(
      "What are the pros and cons of remote work?",
      {
        pros: "List of advantages",
        cons: "List of disadvantages",
        conclusion: "Summary statement"
      }
    );
    console.log(structuredResponse);

  } catch (error) {
    console.error("Error in example:", error.message);
  }
}

// Uncomment to run the example
// example();