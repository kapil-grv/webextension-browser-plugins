// Global state management
const state = {
    currentIndex: "",
    currentPage: 0,
    pageSize: 10,
    totalDocs: 0,
    totalPages: 0,
    sortField: "_doc",
    sortOrder: "asc"
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

function initializeEventListeners() {
    document.getElementById("connectBtn").addEventListener("click", handleConnection);
    document.getElementById("prevPage").addEventListener("click", handlePrevPage);
    document.getElementById("nextPage").addEventListener("click", handleNextPage);
    document.getElementById("backToIndexes").addEventListener("click", handleBackToIndexes);
    document.getElementById("backToMain").addEventListener("click", handleBackToMain);
}

function handleBackToMain() {
    toggleView('.index-list-container', false);
    toggleView('.connection-form', true);
}

async function handleConnection() {
    const connectionDetails = getConnectionDetails();
    try {
        const indices = await fetchElasticsearchIndices(connectionDetails);
        displayIndices(indices);
    } catch (error) {
        showError("Connection failed: " + error.message);
    }
}

function getConnectionDetails() {
    return {
        protocol: document.getElementById("protocol").value,
        host: document.getElementById("host").value,
        port: document.getElementById("port").value,
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
    };
}

async function fetchElasticsearchIndices({ protocol, host, port, username, password }) {
    const headers = new Headers();
    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    const response = await fetch(`${protocol}://${host}:${port}/_cat/indices?format=json`, {
        headers,
        mode: 'cors'
    });

    if (!response.ok) throw new Error(`Failed to fetch indices: ${response.status}`);

    const indices = await response.json();

    return indices.map(index => ({
        index: index.index,
        totalDocs: parseInt(index["docs.count"], 10) || 0,
        size: index["store.size"],
        health: index.health
    }));
}

function displayIndices(indices) {
    toggleView('.connection-form', false);
    toggleView('.index-list-container', true);

    const indexList = document.getElementById("indexList");
    indexList.innerHTML = "";

    if (!document.getElementById('downloadContainer')) {
        const downloadContainer = document.createElement('div');
        downloadContainer.id = 'downloadContainer';
        downloadContainer.style.marginTop = '20px';
        downloadContainer.style.textAlign = 'right';
        document.querySelector('.index-list-container').appendChild(downloadContainer);
    }

    indices.forEach(index => {
        const row = createIndexRow(index);
        indexList.appendChild(row);
    });

    addIndexButtonListeners();
}

function addIndexButtonListeners() {
    document.querySelectorAll(".index-btn").forEach(button => {
        // console.log(`button data :: ${JSON.stringify(button.dataset)}`);
        // console.log(`${button.dataset.index} || ${parseInt(button.dataset.totaldocs)}`);
        const indexName = button.dataset.index;
        const totalDocs = parseInt(button.dataset.totaldocs) || 0;
        console.log(`Triggering index open for :: ${indexName} | ${totalDocs}`)
        button.addEventListener("click", () => handleIndexSelection(indexName, totalDocs));
    });

    document.querySelectorAll(".download-btn").forEach(button => {
        button.addEventListener("click", async (e) => {
            e.stopPropagation();
            const indexName = button.dataset.index;
            await handleDownload(indexName);
        });
    });
}

function createIndexRow(index) {
    const row = document.createElement("tr");
    console.log(`Creating Index row for :: ${JSON.stringify(index)}`);
    row.innerHTML = `
        <td>
            <button class="index-btn" data-index="${index.index}" data-totalDocs="${index.totalDocs}">
                ${index.index}
            </button>
            <button class="download-btn" data-index="${index.index}">⬇️</button>
        </td>
        <td>${index.totalDocs}</td>
        <td>${index.size}</td>
        <td class="${index.health === 'green' ? 'healthy' : 'unhealthy'}">${index.health}</td>
    `;
    return row;
}

// pagination handlers
function handlePrevPage() {
    if (state.currentPage > 0) {
        state.currentPage--;
        fetchAndDisplayData();
    }
}

function handleNextPage() {
    if (state.currentPage + 1 < state.totalPages) {
        state.currentPage++;
        fetchAndDisplayData();
    }
}

function handleBackToIndexes() {
    toggleView('.results-container', false);
    toggleView('.index-list-container', true);
}

async function handleIndexSelection(indexName, totalDocs) {
    state.currentIndex = indexName;
    state.currentPage = 0;
    state.totalDocs = totalDocs;  // Ensure this is correctly set
    state.totalPages = Math.ceil(totalDocs / state.pageSize) || 1; // Avoid division by 0

    // Update UI
    const totalPagesElement = document.getElementById("totalPages");
    if (totalPagesElement) {
        totalPagesElement.innerText = state.totalPages;
    }

    const totalDocsElement = document.getElementById("totalDocs");
    if (totalDocsElement) {
        totalDocsElement.innerText = `Total Documents: ${totalDocs}`;
    }

    await fetchAndDisplayData();
}

async function fetchAndDisplayData() {
    try {
        const results = await searchElasticsearchIndex({
            ...getConnectionDetails(),
            index: state.currentIndex,
            page: state.currentPage,
            sortField: state.sortField,
            sortOrder: state.sortOrder
        });
        displayResults(results);
        updatePaginationUI();
    } catch (error) {
        showError(error.message);
    }
}

// searchElasticsearchIndex function
async function searchElasticsearchIndex({ protocol, host, port, username, password, index, page }) {
    const headers = getHeaders(username, password);
    const body = {
        size: state.pageSize,
        from: page * state.pageSize,
        sort: [{ [state.sortField]: state.sortOrder }]
    };

    const response = await fetch(`${protocol}://${host}:${port}/${index}/_search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const data = await response.json();
    return { hits: data.hits.hits, hasMore: data.hits.hits.length === state.pageSize };
}

function displayResults({ hits }) {
    toggleView('.index-list-container', false);
    toggleView('.results-container', true);

    const table = document.getElementById("resultsTable");
    table.innerHTML = "";

    if (hits.length === 0) {
        table.innerHTML = "<tr><td colspan='3'>No results found</td></tr>";
        return;
    }

    // Create headers
    const headers = Object.keys(hits[0]._source || {});
    const headerRow = document.createElement("tr");
    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Create data rows
    hits.forEach(doc => {
        const row = document.createElement("tr");
        headers.forEach(header => {
            const td = document.createElement("td");
            const value = doc._source[header];

            if (typeof value === "object" && value !== null) {
                const expander = document.createElement("button");
                expander.textContent = "▶";
                expander.classList.add("json-expander");
                expander.addEventListener("click", () => toggleJson(expander, value));

                const container = document.createElement("div");
                container.appendChild(expander);
                td.appendChild(container);
            } else {
                td.textContent = value !== undefined ? String(value) : "";
            }

            row.appendChild(td);
        });
        table.appendChild(row);
    });

    updatePaginationUI();
}

// Updated download functionality
async function handleDownload(indexName) {
    try {
        const downloadButton = document.querySelector(`[data-index="${indexName}"].download-btn`);
        downloadButton.textContent = '⏳'; // Show loading state
        downloadButton.disabled = true;

        const allData = await fetchAllDocuments(indexName);
        downloadAsJSON(allData, indexName);

        // Reset button state
        downloadButton.textContent = '⬇️';
        downloadButton.disabled = false;
    } catch (error) {
        showError("Download failed: " + error.message);
        // Reset button state on error
        const downloadButton = document.querySelector(`[data-index="${indexName}"].download-btn`);
        downloadButton.textContent = '⬇️';
        downloadButton.disabled = false;
    }
}

async function fetchAllDocuments(indexName) {
    const { protocol, host, port, username, password } = getConnectionDetails();
    const allDocs = [];
    let from = 0;

    // First, get the total count of documents
    const countResponse = await fetch(`${protocol}://${host}:${port}/${indexName}/_count`, {
        headers: getHeaders(username, password)
    });
    if (!countResponse.ok) throw new Error(`Failed to get document count: ${countResponse.status}`);
    const { count } = await countResponse.json();

    // Fetch documents in batches
    while (from < count) {
        const response = await fetch(`${protocol}://${host}:${port}/${indexName}/_search`, {
            method: 'POST',
            headers: getHeaders(username, password),
            body: JSON.stringify({
                from,
                size: 1000,
                sort: [{ "_doc": "asc" }]
            })
        });

        if (!response.ok) throw new Error(`Failed to fetch documents: ${response.status}`);

        const data = await response.json();
        allDocs.push(...data.hits.hits.map(hit => hit._source));
        from += 1000;

        if (data.hits.hits.length < 1000) break;
    }

    return allDocs;
}


function downloadAsJSON(data, indexName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${indexName}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Added missing toggleJson function
function toggleJson(button, json) {
    const parentDiv = button.parentElement;
    if (button.nextSibling) {
        parentDiv.removeChild(button.nextSibling);
        button.textContent = "▶";
    } else {
        const pre = document.createElement("pre");
        pre.classList.add("json-content");
        pre.textContent = JSON.stringify(json, null, 2);
        parentDiv.appendChild(pre);
        button.textContent = "▼";
    }
}

// Utility Functions
function toggleView(selector, show) {
    document.querySelector(selector).style.display = show ? "block" : "none";
}

function showError(message) {
    alert(message);
}

function getHeaders(username, password) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }
    return headers;
}

function updatePaginationUI() {
    document.getElementById("pageNumber").textContent = `Page ${state.currentPage + 1} of ${state.totalPages}`;
    document.getElementById("prevPage").disabled = state.currentPage === 0;
    document.getElementById("nextPage").disabled = state.currentPage + 1 >= state.totalPages;
}