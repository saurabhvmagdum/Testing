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
  constructor(config = {}) {
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

    // Add timeout and rate limiting
    this.timeout = config.timeout || 10000;
    this.delayBetweenRequests = config.delayBetweenRequests || 2000;
    this.maxRetries = config.maxRetries || 3;
  }

  validateInput(query, count) {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query parameter');
    }
    if (!count || typeof count !== 'number' || count < 1) {
      throw new Error('Invalid count parameter');
    }
  }

  async fetchArticles(query, count = 10) {
    try {
      this.validateInput(query, count);
      logger.info(`Fetching ${count} articles for query: ${query}`);
      
      const articles = [];
      const pageSize = 10;
      const numPages = Math.ceil(count / pageSize);
      let retries = 0;

      for (let page = 0; page < numPages; page++) {
        try {
          const response = await axios.get(`${this.baseUrl}/scholar`, {
            headers: this.headers,
            params: {
              q: query,
              start: page * pageSize,
              hl: 'en',
              as_sdt: '0,5'
            },
            timeout: this.timeout
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

          await new Promise(resolve => setTimeout(resolve, this.delayBetweenRequests));
        } catch (error) {
          if (retries < this.maxRetries) {
            retries++;
            logger.warn(`Retry ${retries}/${this.maxRetries} for page ${page}`);
            page--; // Retry current page
            await new Promise(resolve => setTimeout(resolve, this.delayBetweenRequests * 2));
            continue;
          }
          throw error;
        }
      }

      logger.info(`Successfully fetched ${articles.length} articles`);
      return articles.slice(0, count);

    } catch (error) {
      logger.error(`Scholar fetch failed: ${error.message}`);
      throw new Error(`Failed to fetch articles: ${error.message}`);
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

module.exports = { ScholarFetcher };