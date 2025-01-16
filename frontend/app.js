// Function to fetch Google Scholar articles

function fetchScholarArticles() {
    const query = document.getElementById("scholar-query").value;
    
    fetch('http://localhost:5000/fetch-scholar-articles', {
      method: 'POST',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query, count: 5 }),
    })
      .then(response => {
        console.log("RES=",response.json());
        response.json();
      
      })
      .then(data => {console.log("data11=",data);
        displayArticles(data); // Call a function to display articles
      })
      .catch(error => {
        console.error('Error fetching scholar articles:', error);
      });
  }
  
  // Function to display the Google Scholar articles
  function displayArticles(articles) {
    const articlesDiv = document.getElementById("scholar-articles");
    articlesDiv.innerHTML = '';  // Clear previous results
    
    if (articles.length === 0) {
      articlesDiv.innerHTML = 'No articles found.';
      return;
    }
  
    articles.forEach(article => {
      const articleDiv = document.createElement('div');
      articleDiv.innerHTML = `
        <h3>${article.title}</h3>
        <p><strong>Authors:</strong> ${article.authors}</p>
        <p><strong>Year:</strong> ${article.year}</p>
        <p><strong>Abstract:</strong> ${article.abstract}</p>
        <a href="${article.url}" target="_blank">Read More</a>
        <hr>
      `;
      articlesDiv.appendChild(articleDiv);
    });
  }
 
  