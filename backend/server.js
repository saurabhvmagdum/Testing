// backend/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require('cors'); 
const axios = require("axios");
const bodyParser = require("body-parser");
//const { VectorDatabase } = require("./vectorDatabase");
const { RAGSystem } = require("./ragSystem");

app.use(cors());
// Configure Environment Variables
dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing required environment variable: GEMINI_API_KEY");
  process.exit(1);
}

const app = express();
app.use(bodyParser.json());

// Initialize Vector Database and RAG System
//const vectorDb = new VectorDatabase(GEMINI_API_KEY);
const ragSystem = new RAGSystem(GEMINI_API_KEY);

app.get("/messages", (req, res) => {
  res.send("Hello Saurabh");
});

// Fetch articles from Google Scholar
app.post("/fetch-articles", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter." });
  }

  try {
    const response = await axios.get(`https://api.scholar.example.com/search`, {
      params: { q: query, count: 10 },
    });

    const articles = response.data.articles || [];
    const abstracts = articles.map((article) => article.abstract).filter(Boolean);

    // Add abstracts to vector database
    await vectorDb.addDocuments(abstracts);

    res.json({ articles, abstracts });
  } catch (error) {
    console.error("Error fetching articles:", error.message);
    res.status(500).json({ error: "Failed to fetch articles." });
  }
});

// Retrieve and summarize
app.post("/summarize", async (req, res) => {
  const { query } = req.body;

  try {
    const relevantDocs = await vectorDb.similaritySearch(query);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n");

    const prompt = `Summarize the latest research on ${query}:\n${context}`;
    const summary = await ragSystem.generateResponse(prompt);

    res.json({ summary });
  } catch (error) {
    console.error("Error summarizing documents:", error.message);
    res.status(500).json({ error: "Failed to summarize documents." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.use(
  cors({
    origin: 'http://localhost:5000', // Replace with your client origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  })
);