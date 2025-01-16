const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('winston');

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

class ScholarFetcher {
  constructor() {
    // Base URL for Google Scholar
    this.baseUrl = 'https://scholar.google.com';
    
    // Headers to mimic a browser request
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
    };
  }

  async fetchArticles(query, count = 10) {
    console.log("get into fetch article");
    try {
      const articles = [];
      const pageSize = 10; // Google Scholar shows 10 results per page
      const numPages = Math.ceil(count / pageSize);

      for (let page = 0; page < numPages; page++) {
        const start = page * pageSize;
        const url = `${this.baseUrl}/scholar`;
        
        const response = await axios.get(url, {
          headers: this.headers,
          params: {
            q: query,
            start: start,
            hl: 'en',
            as_sdt: '0,5'
          }
        });

        const $ = cheerio.load(response.data);
        const articleElements = $('.gs_r.gs_scl');

        articleElements.each((idx, element) => {
          if (articles.length >= count) return false;

          const $element = $(element);
          const articleData = this.parseArticleElement($, $element);
          
          if (articleData) {
            articles.push(articleData);
          }
        });

        if (articles.length >= count) break;

        // Add delay between requests to avoid being blocked
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      logger.info(`Successfully fetched ${articles.length} articles`);
      return articles.slice(0, count);

    } catch (error) {
      logger.error(`Error fetching articles: ${error.message}`);
      throw error;
    }
  }

  parseArticleElement($, element) {
    try {
      const titleElement = element.find('.gs_rt').first();
      const title = titleElement.text().trim();
      const url = titleElement.find('a').attr('href');

      const snippetElement = element.find('.gs_rs').first();
      const abstract = snippetElement.text().trim();

      const metaElement = element.find('.gs_a').first();
      const metaText = metaElement.text();
      
      // Parse authors and year from meta text
      const meta = this.parseMetaText(metaText);

      return {
        title,
        abstract,
        url,
        ...meta
      };

    } catch (error) {
      logger.error(`Error parsing article element: ${error.message}`);
      return null;
    }
  }

  parseMetaText(metaText) {
    try {
      // Meta text format: "Authors - Publication, Year - Publisher"
      const parts = metaText.split(' - ');
      
      return {
        authors: parts[0]?.trim() || '',
        year: parts[1]?.match(/\d{4}/)?.[0] || '',
        publication: parts[1]?.replace(/,.*$/, '')?.trim() || ''
      };

    } catch (error) {
      logger.error(`Error parsing meta text: ${error.message}`);
      return {
        authors: '',
        year: '',
        publication: ''
      };
    }
  }
}

module.exports = ScholarFetcher;

// Example usage
async function example() {
  try {
    const scholarFetcher = new ScholarFetcher();
    const articles = await scholarFetcher.fetchArticles('artificial intelligence', 5);
    
    console.log('\nFetched Articles:');
    articles.forEach((article, index) => {
      console.log(`\nArticle ${index + 1}:`);
      console.log('Title:', article.title);
      console.log('Authors:', article.authors);
      console.log('Year:', article.year);
      console.log('Abstract:', article.abstract);
      console.log('URL:', article.url);
      console.log('Publication:', article.publication);
    });

  } catch (error) {
    console.error('Error in example:', error.message);
  }
}

// Uncomment to run the example
// example();