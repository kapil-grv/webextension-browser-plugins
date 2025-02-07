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

class GeoDataViewer {
    constructor() {
        this.db = null;
        this.conn = null;
        this.map = null;
        this.init();
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
            logMessage(`Drivers available: ${JSON.stringify(drivers)}`);

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
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        logMessage('Map initialized.');
    }

    setupFileInput() {
        logMessage('Setting up file input listener...');
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            logMessage(`File selected: ${file.name}`);

            try {
                if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
                    await this.processGeoJSON(file);
                } else if (file.name.endsWith('.csv')) {
                    await this.processCSV(file);
                } else if (file.name.endsWith('.parquet')) {
                    await this.processParquet(file);
                } else if (file.name.endsWith('.shp') || file.name.endsWith('.gpkg') || file.name.endsWith('.fgb')) {
                    await this.processSpatialFile(file);
                } else {
                    logMessage('Unsupported file format.', true);
                    console.warn('Unsupported file format.');
                }
            } catch (error) {
                logMessage(`Error processing file: ${error.message}`, true);
                console.error('Error processing file:', error);
            }
        });
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

            await this.visualizeGeoJSON();
        } catch (error) {
            logMessage(`Error while processing GeoJSON: ${error.message}`, true);
            console.error('Error while processing GeoJSON:', error);
        }
    }

    async processSpatialFile(file) {
        logMessage(`Processing spatial file: ${file.name}...`);

        try {
            const fileHandles = await window.showOpenFilePicker({
                multiple: true,
                types: [
                    {
                        description: "Spatial Files",
                        accept: {
                            "application/octet-stream": [".shp", ".shx", ".dbf", ".gpkg", ".fgb"],
                        },
                    },
                ],
            });

            const fileMap = new Map();
            for (const handle of fileHandles) {
                const file = await handle.getFile();
                const buffer = await file.arrayBuffer();
                fileMap.set(file.name, buffer);
            }

            for (const [filename, buffer] of fileMap.entries()) {
                await this.db.registerFileBuffer(`/tmp/${filename}`, buffer);
                logMessage(`Registered file: /tmp/${filename}`);
            }

            await this.conn.query(`DROP TABLE IF EXISTS geodata;`);
            await this.conn.query(`CREATE TABLE geodata AS SELECT * FROM ST_Read('/tmp/${file.name}');`);
            logMessage(`${file.name} successfully loaded into DuckDB.`);

            await this.visualizeGeoJSON();
        } catch (error) {
            logMessage(`Error while processing ${file.name}: ${error.message}`, true);
            console.error(`Error while processing ${file.name}:`, error);
        }
    }

    async visualizeGeoJSON() {
        try {
            logMessage('Fetching GeoJSON data for visualization...');
            const result = await this.conn.query(`
                SELECT ST_AsGeoJSON(geom) as geojson 
                FROM geodata 
                LIMIT 1000;
            `);

            logMessage(`Fetched ${result.length} features.`);
            this.map.eachLayer((layer) => {
                if (layer instanceof L.GeoJSON) {
                    this.map.removeLayer(layer);
                }
            });

            const features = result.toArray().map(row => JSON.parse(row.geojson));
            const geojsonLayer = L.geoJSON({
                type: 'FeatureCollection',
                features: features
            }).addTo(this.map);

            this.map.fitBounds(geojsonLayer.getBounds());
            logMessage('GeoJSON data visualized.');
        } catch (error) {
            logMessage(`Error while visualizing GeoJSON: ${error.message}`, true);
            console.error('Error while visualizing GeoJSON:', error);
        }
    }
}

// Initialize the viewer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new GeoDataViewer();
});
