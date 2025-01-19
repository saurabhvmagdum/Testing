const API_BASE_URL = 'http://localhost:5000';

// Show loading state
function setLoading(isLoading) {
  const button = document.querySelector('#fetch-button');
  const loader = document.querySelector('#loader');
  if (button && loader) {
    button.disabled = isLoading;
    loader.style.display = isLoading ? 'block' : 'none';
  }
}

// Display error messages
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
  }
}

async function checkSystemStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const statusDiv = document.getElementById('system-status');
    
    if (data.status === 'ok' && data.vectorDb === 'ready') {
      statusDiv.className = 'system-status status-ok';
      statusDiv.textContent = 'System ready';
      document.getElementById('fetch-button').disabled = false;
    } else {
      statusDiv.className = 'system-status status-error';
      statusDiv.textContent = 'System initializing...';
      document.getElementById('fetch-button').disabled = true;
    }
  } catch (error) {
    console.error('Health check failed:', error);
    showError('Failed to fetch system status. Please try again later.');
  }
}

async function fetchScholarArticles() {
  const query = 'example query'; // Replace with actual query input
  setLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const articlesDiv = document.getElementById('articles');
    articlesDiv.innerHTML = data.results.map(result => `<div>${result}</div>`).join('');
  } catch (error) {
    console.error('Error fetching scholar articles:', error);
    showError('Failed to fetch articles. Please try again later.');
  } finally {
    setLoading(false);
  }
}

function displayArticles(articles) {
  const articlesDiv = document.getElementById("scholar-articles");
  articlesDiv.innerHTML = '';

  if (!articles || articles.length === 0) {
    articlesDiv.innerHTML = '<p>No articles found.</p>';
    return;
  }

  const articlesHtml = articles.map(article => `
    <div class="article-card">
      <h3>${article.title || 'Untitled'}</h3>
      <p class="authors"><strong>Authors:</strong> ${article.authors || 'Unknown'}</p>
      <p class="year"><strong>Year:</strong> ${article.year || 'N/A'}</p>
      <p class="abstract"><strong>Abstract:</strong> ${article.abstract || 'No abstract available'}</p>
      ${article.url ? `<a href="${article.url}" target="_blank" class="read-more">Read More</a>` : ''}
      <button onclick="summarizeArticle('${article.title}')" class="summarize-btn">Summarize</button>
      <hr>
    </div>
  `).join('');

  articlesDiv.innerHTML = articlesHtml;
}

async function summarizeArticle(title) {
  try {
    setLoading(true);
    
    // Escape special characters in title for querySelector
    const escapedTitle = title.replace(/"/g, '\\"');
    const articleElement = document.querySelector(`.article-card h3[title="${escapedTitle}"]`)?.parentNode;
    
    if (!articleElement) {
      throw new Error('Article element not found');
    }

    const response = await fetch(`${API_BASE_URL}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: title })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate summary');
    }

    // Remove existing summary if present
    const existingSummary = articleElement.querySelector('.summary');
    if (existingSummary) {
      existingSummary.remove();
    }

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'summary';
    summaryDiv.innerHTML = `
      <h4>Summary:</h4>
      <p>${data.summary}</p>
      <p class="sources">Based on ${data.sourcesCount || 0} sources</p>
    `;
    
    articleElement.appendChild(summaryDiv);
  } catch (error) {
    showError('Error generating summary: ' + error.message);
  } finally {
    setLoading(false);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  checkSystemStatus();
});
