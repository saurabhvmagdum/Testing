const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 
const { ScholarFetcher } = require('./scholarFetcher');
const { VectorDatabase } = require('./vectorDatabase');
const { RAGSystem } = require('./ragSystem');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
// Body parser middleware
app.use(bodyParser.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize backend services
const vectorDb = new VectorDatabase(
  process.env.GEMINI_API_KEY,
  process.env.PINECONE_API_KEY,
  process.env.PINECONE_ENVIRONMENT
);
const ragSystem = new RAGSystem(process.env.GEMINI_API_KEY);


app.get("/messages", (req, res) => {
  res.send("Hello Saurabh 123");
});

// Route to fetch Google Scholar articles
app.post('/fetch-scholar-articles', async (req, res) => {

  console.log("Request",req);
  try {
    const { query, count } = req.body; // Query and count from client
    const scholarFetcher = new ScholarFetcher();
    console.log("scholarFetcher==",scholarFetcher.json());
    //const articles = await scholarFetcher.fetchArticles(query, count);
    //res.status(200).json(articles); // Respond with the articles
  } catch (error) {
    console.error("Error fetching Google Scholar articles:", error.message);
    res.status(500).json({ error: "Error fetching articles" });
  }
});

// Route to generate a response based on provided context
app.post('/generate-response', async (req, res) => {
  try {
    const { prompt } = req.body; // Prompt from client
    const response = await ragSystem.generateResponse(prompt);
    res.status(200).json({ response }); // Respond with the generated response
  } catch (error) {
    console.error("Error generating response:", error.message);
    res.status(500).json({ error: "Error generating response" });
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

// In app.js
app.use(express.static('public'));

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});