document.getElementById("connectBtn").addEventListener("click", async () => {
    const host = document.getElementById("host").value;
    const port = document.getElementById("port").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const indices = await fetchElasticsearchIndices(host, port, username, password);
        displayIndices(indices);
    } catch (error) {
        alert("Connection failed: " + error.message);
    }
});

async function fetchElasticsearchIndices(host, port, username, password) {
    const headers = new Headers();
    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    const response = await fetch(`http://${host}:${port}/_cat/indices?format=json`, { headers });
    if (!response.ok) throw new Error("Failed to fetch indices");

    return await response.json();
}

function displayIndices(indices) {
    document.querySelector(".connection-form").style.display = "none";
    document.querySelector(".index-list-container").style.display = "block";

    const indexList = document.getElementById("indexList");
    indexList.innerHTML = "";

    indices.forEach(index => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><button class="index-btn" data-index="${index.index}">${index.index}</button></td>
            <td>${index["docs.count"]}</td>
            <td>${index["store.size"]}</td>
            <td>${index.health}</td>
        `;
        indexList.appendChild(row);
    });

    document.querySelectorAll(".index-btn").forEach(button => {
        button.addEventListener("click", () => fetchIndexData(button.dataset.index, 0));
    });
}

// **Pagination Variables**
let currentIndex = "";
let currentPage = 0;
const pageSize = 10;
let totalDocs = 0;
let totalPages = 0;

async function fetchIndexData(index, page) {
    currentIndex = index;
    currentPage = page;

    const host = document.getElementById("host").value;
    const port = document.getElementById("port").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        await fetchTotalDocs(index);
        const results = await searchElasticsearchIndex({ host, port, username, password, index, page });
        displayResults(results);
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function searchElasticsearchIndex({ host, port, username, password, index, page }) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (username && password) {
        headers.append('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    const body = {
        size: pageSize,
        from: page * pageSize, // Pagination offset
        sort: [{ "_doc": "asc" }] // Ensures stable sorting order
    };

    const response = await fetch(`http://${host}:${port}/${index}/_search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    return { hits: data.hits.hits, hasMore: data.hits.hits.length === pageSize };
}

async function fetchTotalDocs(index) {
    const host = document.getElementById("host").value;
    const port = document.getElementById("port").value;

    try {
        const response = await fetch(`http://${host}:${port}/${index}/_count`);
        const data = await response.json();
        totalDocs = data.count;
        totalPages = Math.ceil(totalDocs / pageSize);

        // Update UI
        document.getElementById("totalPages").innerText = totalPages;
        document.getElementById("totalDocs").innerText = `Total Documents: ${totalDocs}`;
    } catch (error) {
        console.error("Error fetching total docs:", error);
    }
}

function displayResults({ hits }) {
    document.querySelector(".index-list-container").style.display = "none";
    document.querySelector(".results-container").style.display = "block";

    const table = document.getElementById("resultsTable");
    table.innerHTML = "";

    if (hits.length === 0) {
        table.innerHTML = "<tr><td colspan='3'>No results found</td></tr>";
        return;
    }

    const headers = Object.keys(hits[0]._source || {});
    const headerRow = document.createElement("tr");
    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    hits.forEach(doc => {
        const row = document.createElement("tr");
        headers.forEach(header => {
            const td = document.createElement("td");
            const value = doc._source[header];

            if (typeof value === "object" && value !== null) {
                // Create an expander button
                const expander = document.createElement("button");
                expander.textContent = "▶";
                expander.classList.add("json-expander");
                expander.addEventListener("click", () => toggleJson(expander, value));

                const container = document.createElement("div");
                container.appendChild(expander);
                td.appendChild(container);
            } else {
                td.textContent = JSON.stringify(value);
            }

            row.appendChild(td);
        });
        table.appendChild(row);
    });

    document.getElementById("pageNumber").textContent = `Page ${currentPage + 1} of ${totalPages}`;
    document.getElementById("prevPage").disabled = currentPage === 0;
    document.getElementById("nextPage").disabled = currentPage + 1 >= totalPages;
}

// Function to toggle JSON expander
function toggleJson(button, json) {
    const parentDiv = button.parentElement;

    // If JSON is already expanded, collapse it
    if (button.nextSibling) {
        parentDiv.removeChild(button.nextSibling);
        button.textContent = "▶"; // Collapse symbol
    } else {
        const pre = document.createElement("pre");
        pre.classList.add("json-content");
        pre.textContent = JSON.stringify(json, null, 2);
        parentDiv.appendChild(pre);
        button.textContent = "▼"; // Expand symbol
    }
}


// **Pagination Buttons**
document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 0) fetchIndexData(currentIndex, currentPage - 1);
});

document.getElementById("nextPage").addEventListener("click", () => {
    if (currentPage + 1 < totalPages) fetchIndexData(currentIndex, currentPage + 1);
});

// **Back to Indices**
document.getElementById("backToIndexes").addEventListener("click", () => {
    document.querySelector(".results-container").style.display = "none";
    document.querySelector(".index-list-container").style.display = "block";
});
