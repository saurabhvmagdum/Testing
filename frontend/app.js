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

async function fetchScholarArticles() {
  const query = document.getElementById("scholar-query").value;
  
  if (!query) {
    showError('Please enter a search query');
    return;
  }

  setLoading(true);
  
  try {
    const response = await fetch(`${API_BASE_URL}/fetch-scholar-articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, count: 5 })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.articles) {
      displayArticles(data.articles);
      if (data.abstractsAdded > 0) {
        showError(`Added ${data.abstractsAdded} abstracts to the database`);
      }
    } else {
      showError('No articles found');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Error fetching articles: ' + error.message);
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
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      fetchScholarArticles();
    });
  }
});

