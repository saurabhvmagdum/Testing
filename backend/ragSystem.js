require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("winston");

// Improved logger configuration
logger.configure({
  transports: [
    new logger.transports.Console({
      format: logger.format.combine(
        logger.format.timestamp(),
        logger.format.colorize(),
        logger.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      )
    })
  ]
});

class RAGSystem {
  constructor(apiKey, config = {}) {
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
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.95,
          topK: config.topK || 50,
          maxOutputTokens: config.maxOutputTokens || 150,
        }
      });

      logger.info("Gemini model initialized successfully.");
    } catch (error) {
      logger.error(`Error initializing the Gemini model: ${error.message}`);
      throw error;
    }

    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 2;

    this.promptTemplates = {
      summarize: (query, context) => `
        Summarize the latest research on ${query}.
        Focus on key findings and conclusions.
        Use only the provided context:
        ${context}
      `,
      // Add more templates as needed
    };
  }

  validateResponse(text) {
    if (!text || typeof text !== 'string' || text.length < 10) {
      throw new Error('Invalid response from model');
    }
    return text.trim();
  }

  async withTimeout(promise) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), this.timeout);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  sanitizePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt provided');
    }
    return prompt.trim().replace(/[^\w\s.,?!-]/g, '');
  }

  async generateResponse(prompt, options = {}) {
    /**
     * Generates a response for the given prompt using the Gemini API.
     * @param {string} prompt - The input prompt for generating content.
     * @returns {string} The generated response text.
     */
    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        const sanitizedPrompt = this.sanitizePrompt(prompt);
        logger.info(`Generating response for prompt: ${sanitizedPrompt.substring(0, 50)}...`);

        // Generate content
        const result = await this.withTimeout(
          this.model.generateContent(sanitizedPrompt)
        );
        const text = result.response.text();
        return this.validateResponse(text);
      } catch (error) {
        attempts++;
        if (attempts === this.maxRetries) {
          logger.error(`Error in generateResponse: ${error.message}`);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  async generateStreamResponse(prompt) {
    /**
     * Generates a streaming response for the given prompt using the Gemini API.
     * @param {string} prompt - The input prompt for generating content.
     * @returns {AsyncGenerator} A generator that yields response chunks.
     */
    try {
      const sanitizedPrompt = this.sanitizePrompt(prompt);
      logger.info(`Generating stream response for prompt: ${sanitizedPrompt.substring(0, 50)}...`);

      // Generate streaming content
      const result = await this.model.generateContentStream(sanitizedPrompt);
      
      // Add error handling for stream
      if (!result) {
        throw new Error('Failed to generate stream response');
      }

      return result;
    } catch (error) {
      logger.error(`Error in generateStreamResponse: ${error.message}`);
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