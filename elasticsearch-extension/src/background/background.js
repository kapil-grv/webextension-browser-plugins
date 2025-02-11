chrome.action.onClicked.addListener(() => {
    chrome.windows.create({
        url: chrome.runtime.getURL("popup/popup.html"),
        type: "popup",
        width: 600,
        height: 500,
        left: 750,
        top: 300,
        focused: true
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchIndexes") {
        fetchElasticsearchIndexes(request)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === "search") {
        searchElasticsearchIndex(request)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// Fetch indexes
async function fetchElasticsearchIndexes({ host, port, username, password }) {
    const headers = new Headers();
    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    const response = await fetch(`http://${host}:${port}/_cat/indices?format=json`, { headers });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
}

// Store scroll ID for pagination
let scrollId = null;

async function searchElasticsearchIndex({ host, port, username, password, index, pageSize = 10, nextPage = false }) {
    const headers = new Headers({
        'Content-Type': 'application/json'
    });

    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    let url = `http://${host}:${port}/${index}/_search?scroll=1m`; // Keep the search context alive
    let body = {
        size: pageSize,
        query: { match_all: {} } // Modify this query as needed
    };

    // Use Scroll ID for next page
    if (nextPage && scrollId) {
        url = `http://${host}:${port}/_search/scroll`;
        body = { scroll: "1m", scroll_id: scrollId };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    scrollId = data._scroll_id; // Save for next request

    return { success: true, data: data.hits.hits, hasMore: data.hits.hits.length === pageSize };
}

// Cleanup function to clear scroll context
async function clearScroll({ host, port, username, password }) {
    if (!scrollId) return;

    const headers = new Headers({
        'Content-Type': 'application/json'
    });

    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    await fetch(`http://${host}:${port}/_search/scroll`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ scroll_id: scrollId })
    });

    scrollId = null;
}
