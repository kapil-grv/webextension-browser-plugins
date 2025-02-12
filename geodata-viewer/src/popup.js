import * as duckdb from '@duckdb/duckdb-wasm';
import L from 'leaflet';

const BUNDLES = {
    mvp: {
        mainModule: chrome.runtime.getURL('lib/duckdb-mvp.wasm'),
        mainWorker: chrome.runtime.getURL('lib/duckdb-browser-mvp.worker.js'),
    },
    eh: {
        mainModule: chrome.runtime.getURL('lib/duckdb-eh.wasm'),
        mainWorker: chrome.runtime.getURL('lib/duckdb-browser-eh.worker.js'),
    },
};

// Logging function to write messages to UI
function logMessage(message, isError = false) {
    const logsElement = document.getElementById("logs");
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}\n`;

    if (isError) {
        logsElement.innerHTML += `<span style="color: red;">${logEntry}</span>`;
    } else {
        logsElement.innerHTML += logEntry;
    }

    logsElement.scrollTop = logsElement.scrollHeight; // Auto-scroll to the latest log
}

const colors = ["#FF5733", "#33FF57", "#3357FF", "#F3FF33", "#FF33A8"];
let colorIndex = 0;

class GeoDataViewer {
    constructor() {
        this.db = null;
        this.conn = null;
        this.map = null;
        this.init();
        this.layers = {};  // Store layers by filename
    }

    async init() {
        try {
            logMessage('Initializing GeoDataViewer...');
            console.log('Document loaded, initializing GeoDataViewer...');

            // Select bundle & initialize DuckDB
            const bundle = await duckdb.selectBundle(BUNDLES);
            const worker = new Worker(bundle.mainWorker);
            this.db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
            await this.db.instantiate(bundle.mainModule);
            logMessage('DuckDB instantiated.');

            // Connect to DB
            this.conn = await this.db.connect();
            logMessage('Connected to DuckDB.');

            // Install & Load Spatial Extension
            await this.conn.query(`INSTALL spatial;`);
            await this.conn.query(`LOAD spatial;`);
            logMessage('Spatial extension installed and loaded.');

            // Verify available functions
            const drivers = await this.conn.query(`SELECT * FROM ST_Drivers();`);
            // logMessage(`Drivers available: ${JSON.stringify(drivers)}`);

            // Initialize map
            this.initMap();
            this.setupFileInput();
        } catch (error) {
            logMessage(`Initialization error: ${error.message}`, true);
            console.error('Initialization error:', error);
        }
    }

    initMap() {
        logMessage('Initializing map...');
        this.map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);
        logMessage('Map initialized.');
    }

    setupFileInput() {
        const fileInput = document.getElementById('fileInput');

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            logMessage(`Selected ${files.length} files.`);

            try {
                const geojsonFiles = [];
                const csvFiles = [];
                const parquetFiles = [];
                const spatialFiles = [];

                for (const file of files) {
                    if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
                        geojsonFiles.push(file);
                    } else if (file.name.endsWith('.csv')) {
                        csvFiles.push(file);
                    } else if (file.name.endsWith('.parquet')) {
                        parquetFiles.push(file);
                    } else if (
                        file.name.endsWith('.shp') || file.name.endsWith('.shx') || file.name.endsWith('.dbf') ||
                        file.name.endsWith('.prj') || file.name.endsWith('.cpg') || file.name.endsWith('.gpkg') ||
                        file.name.endsWith('.fgb')
                    ) {
                        spatialFiles.push(file);
                    } else {
                        logMessage(`Unsupported file format: ${file.name}`, true);
                        console.warn(`Unsupported file format: ${file.name}`);
                    }
                }

                // Process files by type
                for (const file of geojsonFiles) await this.processGeoJSON(file);
                for (const file of csvFiles) await this.processCSV(file);
                for (const file of parquetFiles) await this.processParquet(file);
                if (spatialFiles.length > 0) await this.processSpatialFile(spatialFiles); // Process spatial files as a batch
            } catch (error) {
                logMessage(`Error processing files: ${error.message}`, true);
                console.error('Error processing files:', error);
            }
        });
        logMessage('Listening to file uploads (Please upload all related files if uploading Shapefile)...');
    }

    async processCSV(file) {
        logMessage(`Processing CSV file: ${file.name}...`);

        try {
            // Read CSV file
            const text = await file.text();
            await this.db.registerFileText('csvfile.csv', text);
            logMessage('Registered CSV file in DuckDB.');
            console.log(text);

            const csv = await this.conn.query(`SELECT * FROM read_csv_auto('csvfile.csv');`);

            if (csv.length === 0) {
                logMessage(`No data found in ${file.name}`, true);
                return;
            }

            logMessage(`CSV loaded with ${csv.length} rows.`);

            // Convert the result to an array
            const data = csv.toArray();

            // Detect Latitude and Longitude columns
            const firstRow = data[0];
            const columns = Object.keys(firstRow);

            const latFields = ['lat', 'latitude', 'y', 'ycoord'];
            const lngFields = ['lng', 'lon', 'longitude', 'x', 'xcoord'];

            const latColumn = columns.find(col => latFields.includes(col.toLowerCase()));
            const lngColumn = columns.find(col => lngFields.includes(col.toLowerCase()));

            if (!latColumn || !lngColumn) {
                logMessage(`Could not detect latitude/longitude fields in ${file.name}`, true);
                return;
            }

            logMessage(`Detected latitude: ${latColumn}, longitude: ${lngColumn}`);

            // Drop existing table if necessary
            await this.conn.query(`DROP TABLE IF EXISTS geodata;`);

            // Create a new table with point geometry
            await this.conn.query(`
                CREATE TABLE geodata AS 
                SELECT ST_Point(${lngColumn}, ${latColumn}) AS geom, * EXCLUDE ${latColumn}, ${lngColumn} 
                FROM read_csv_auto('csvfile.csv');`);

            logMessage(`CSV data loaded into DuckDB as geospatial table.`);

            // Visualize the points on the map
            await this.visualizeGeoJSON();

        } catch (error) {
            logMessage(`Error processing CSV: ${error.message}`, true);
            console.error('Error processing CSV:', error);
        }
    }

    async processGeoJSON(file) {
        logMessage('Processing GeoJSON file...');
        const text = await file.text();

        try {
            await this.db.registerFileText('/tmp/geojson.json', text);
            logMessage('Registered GeoJSON file in DuckDB.');
            console.log(text);

            await this.conn.query(`DROP TABLE IF EXISTS geodata;`);
            await this.conn.query(`CREATE TABLE geodata AS SELECT * FROM ST_Read('/tmp/geojson.json');`);
            logMessage('GeoJSON data successfully loaded into DuckDB.');

            await this.visualizeGeoJSON(file.name);
        } catch (error) {
            logMessage(`Error while processing GeoJSON: ${error.message}`, true);
            console.error('Error while processing GeoJSON:', error);
        }
    }

    async processSpatialFile(fileHandles) {
        const shpFile = fileHandles.find(file => file.name.endsWith('.shp'));
        const gpkgFile = fileHandles.find(file => file.name.endsWith('.gpkg'));
        const fgbFile = fileHandles.find(file => file.name.endsWith('.fgb'));

        if (!shpFile && !gpkgFile && !fgbFile) {
            logMessage("No valid spatial file found.", true);
            return;
        }

        // Determine main file name (excluding extension)
        const fileName = shpFile ? shpFile.name.split(".")[0] :
            gpkgFile ? gpkgFile.name.split(".")[0] :
                fgbFile ? fgbFile.name.split(".")[0] : "unknown";

        logMessage(`Processing spatial file: ${fileName}...`);

        try {
            // Read file contents
            const fileMap = new Map();
            for (const file of fileHandles) {
                logMessage(`Reading file: ${file.name}...`);
                const buffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(buffer);

                if (uint8Array.length === 0) {
                    logMessage(`Warning: ${file.name} appears to be empty!`, true);
                }

                fileMap.set(file.name, uint8Array);
                logMessage(`Successfully read ${file.name}, size: ${uint8Array.length} bytes`);
            }

            // Register all files with DuckDB
            for (const [filename, uint8Array] of fileMap.entries()) {
                logMessage(`Registering file with DuckDB: ${filename}`);
                await this.db.registerFileBuffer(filename, uint8Array);
                logMessage(`Successfully registered ${filename}`);
            }

            // Drop table if it exists
            logMessage("Dropping existing table if it exists...");
            await this.conn.query(`DROP TABLE IF EXISTS geodata;`);
            logMessage("Dropped table (if existed).");

            // Load spatial data
            if (shpFile) {
                logMessage(`Executing ST_Read on ${shpFile.name}...`);
                await this.conn.query(`CREATE TABLE geodata AS SELECT * FROM ST_Read('${shpFile.name}');`);
            } else if (gpkgFile) {
                logMessage(`Executing ST_Read on ${gpkgFile.name}...`);
                await this.conn.query(`CREATE TABLE geodata AS SELECT * FROM ST_Read('${gpkgFile.name}');`);
            } else if (fgbFile) {
                logMessage(`Executing ST_Read on ${fgbFile.name}...`);
                await this.conn.query(`CREATE TABLE geodata AS SELECT * FROM ST_Read('${fgbFile.name}');`);
            }

            logMessage(`${fileName} successfully loaded into DuckDB.`);

            // Visualize loaded spatial data
            await this.visualizeGeoJSON(fileName);
        } catch (error) {
            logMessage(`Error while processing ${fileName}: ${error.message}`, true);
            console.error(`Error while processing ${fileName}:`, error);
        }
    }

    async visualizeGeoJSON(filename) {
        try {
            logMessage('Fetching GeoJSON data for visualization...');
            const result = await this.conn.query(`
            SELECT *, ST_AsGeoJSON(geom) AS geojson 
            FROM geodata 
            LIMIT 9999999;
        `);

            // Remove previous GeoJSON layers
            // this.map.eachLayer((layer) => {
            //     if (layer instanceof L.GeoJSON) {
            //         this.map.removeLayer(layer);
            //     }
            // });

            // Convert data to GeoJSON
            const features = result.toArray().map(row => ({
                type: "Feature",
                geometry: JSON.parse(row.geojson),  // Convert geometry to GeoJSON
                properties: Object.fromEntries(
                    Object.entries(row).filter(([key]) => key !== "geojson" && key !== "geom") // Exclude geom and geojson fields
                )
            }));
            console.log(features);
            logMessage(`Fetched ${features.length} features.`);

            // Create a random color for the layer
            const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

            // Cycle through colors
            const currentColor = colors[colorIndex % colors.length];
            colorIndex++;

            // Define the new GeoJSON layer
            const geojsonLayer = L.geoJSON(
                { type: 'FeatureCollection', features: features },
                {
                    style: { color: randomColor, weight: 2, opacity: 0.8 },
                    pointToLayer: (feature, latlng) => {
                        return L.circleMarker(latlng, {
                            radius: 3,  // Adjust size as needed
                            // fillColor: currentColor,
                            // color: "#fff000",  // Outline color
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 1
                        });
                    },
                    onEachFeature: (feature, layer) => {
                        console.log("Feature properties:", feature.properties); // Debugging
                        let popupContent = "<b>Attributes:</b><br><div class='popup-scroll'>";
                        if (feature.properties && Object.keys(feature.properties).length > 0) {
                            Object.entries(feature.properties).forEach(([key, value]) => {
                                popupContent += `<b>${key}</b>: ${value} <br>`;
                            });
                        } else {
                            popupContent += "No attributes available";
                        }
                        layer.bindPopup(popupContent);
                    }
                }
            ).addTo(this.map);

            // Store in layers object
            this.layers[filename] = geojsonLayer;

            this.map.fitBounds(geojsonLayer.getBounds());
            this.updateLayerPanel();
            logMessage(`GeoJSON for ${filename} visualized with color ${currentColor}.`);
        } catch (error) {
            logMessage(`Error while visualizing GeoJSON: ${error.message}`, true);
            console.error('Error while visualizing GeoJSON:', error);
        }
    }

    updateLayerPanel() {
        if (this.layerControl) {
            this.map.removeControl(this.layerControl);
        }

        this.layerControl = L.control({ position: "topright" });

        this.layerControl.onAdd = (map) => {
            const div = L.DomUtil.create("div", "layer-control-panel");
            div.innerHTML = "<h3>Layers</h3>";

            Object.keys(this.layers).forEach(layerName => {
                const layerDiv = document.createElement("div");
                layerDiv.className = "layer-item";
                layerDiv.innerHTML = `
                    <input type="checkbox" checked id="${layerName}-toggle" />
                    <label for="${layerName}-toggle">${layerName}</label>
                `;

                // Toggle event
                layerDiv.querySelector("input").addEventListener("change", (event) => {
                    const layer = this.layers[layerName];
                    if (event.target.checked) {
                        layer.addTo(this.map);
                    } else {
                        this.map.removeLayer(layer);
                    }
                });

                div.appendChild(layerDiv);
            });

            return div;
        };

        this.layerControl.addTo(this.map);
    }


}

// Initialize the viewer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new GeoDataViewer();
});

document.getElementById("clearLogs").addEventListener("click", clearLogs);

function clearLogs() {
    document.getElementById("logs").innerHTML = "";
}