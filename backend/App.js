const express = require('express');
const path = require('path');
const cors = require('cors');
const logger = require('winston');
const { ScholarFetcher } = require('./scholarFetcher');
const { VectorDatabase } = require('./vectorDatabase');
const { RAGSystem } = require('./ragSystem');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // Use built-in Express body parser
app.use(express.static(path.join(__dirname, 'public')));

// Add request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Add input validation middleware
const validateScholarRequest = (req, res, next) => {
  const { query, count } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: "Invalid query parameter" });
  }
  if (!count || typeof count !== 'number' || count < 1) {
    return res.status(400).json({ error: "Invalid count parameter" });
  }
  next();
};

// Add validation middleware for summarize endpoint
const validateSummarizeRequest = (req, res, next) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.length < 3) {
    return res.status(400).json({ error: "Invalid query parameter. Must be at least 3 characters." });
  }
  next();
};

let isVectorDbInitialized = false;

// Initialize backend services
const vectorDb = new VectorDatabase(
  process.env.HUGGINGFACE_API_KEY,  // CORRECT
  process.env.PINECONE_API_KEY,
  process.env.PINECONE_ENVIRONMENT
);

// Add middleware to check VectorDB initialization
const checkVectorDbInitialized = (req, res, next) => {
  if (!isVectorDbInitialized) {
    return res.status(503).json({ 
      error: "Vector database not initialized yet. Please try again in a moment." 
    });
  }
  next();
};

// Initialize Pinecone with retry logic
(async () => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      await vectorDb.initialize();
      isVectorDbInitialized = true;
      logger.info('Vector database initialized successfully');
      break;
    } catch (error) {
      attempts++;
      logger.error(`Failed to initialize vector database (attempt ${attempts}/${maxAttempts}):`, error);
      if (attempts === maxAttempts) {
        process.exit(1);
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
})();

app.get("/messages", (req, res) => {
  res.send("Hello Saurabh 123");
});

// Route to fetch Google Scholar articles
app.post('/fetch-scholar-articles', validateScholarRequest, checkVectorDbInitialized, async (req, res) => {
  try {
    const { query, count } = req.body;

    const scholarFetcher = new ScholarFetcher({
      timeout: 15000,
      delayBetweenRequests: 2000,
      maxRetries: 3
    });
    const articles = await scholarFetcher.fetchArticles(query, count);
    
    // Extract abstracts and add to vector database
    const abstracts = articles
      .map(article => article.abstract)
      .filter(Boolean);
    
    if (abstracts.length > 0) {
      await vectorDb.addDocuments(abstracts);
    }

    res.status(200).json({ 
      articles,
      abstractsAdded: abstracts.length
    });
  } catch (error) {
    logger.error(`Scholar fetch error: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: "Error fetching articles",
      details: error.message
    });
  }
});

// Route to generate a response based on provided context
app.post('/generate-response', async (req, res) => {
  try {
    const { prompt, temperature } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }

    const response = await ragSystem.generateResponse(prompt, { temperature });
    res.status(200).json({ response });
  } catch (error) {
    logger.error(`Error in generate-response: ${error.message}`);
    res.status(500).json({ 
      error: "Error generating response",
      details: error.message 
    });
  }
});

// Route to add documents to the vector database
app.post('/add-documents', async (req, res) => {
  try {
    const { documents } = req.body; // Documents from client
    await vectorDb.addDocuments(documents);
    res.status(200).json({ message: "Documents added to the vector database" });
  } catch (error) {
    console.error("Error adding documents to vector database:", error.message);
    res.status(500).json({ error: "Error adding documents" });
  }
});

// Route to search for similar documents from the vector database
app.post('/similarity-search', async (req, res) => {
  try {
    const { query } = req.body; // Query from client
    const results = await vectorDb.similaritySearch(query);
    res.status(200).json(results); // Respond with the search results
  } catch (error) {
    console.error("Error performing similarity search:", error.message);
    res.status(500).json({ error: "Error performing similarity search" });
  }
});

// Add new route for summarization
app.post("/summarize", validateSummarizeRequest, checkVectorDbInitialized, async (req, res) => {
  try {
    const { query } = req.body;
    const relevantDocs = await vectorDb.similaritySearch(query);
    
    if (!relevantDocs.length) {
      return res.status(404).json({ 
        message: "No relevant documents found for the query" 
      });
    }

    const context = relevantDocs.map((doc) => doc.document).join("\n");
    const prompt = `Summarize the latest research on ${query}:\n${context}`;
    const summary = await ragSystem.generateResponse(prompt);

    res.json({ 
      summary,
      sourcesCount: relevantDocs.length 
    });
  } catch (error) {
    logger.error("Error summarizing documents:", error.message);
    res.status(500).json({ 
      error: "Failed to summarize documents",
      details: error.message 
    });
  }
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    vectorDb: isVectorDbInitialized ? 'ready' : 'initializing'
  });
});

// Add global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});