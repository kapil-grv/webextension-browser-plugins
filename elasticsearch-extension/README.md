# Elasticsearch Web Extension

## Overview
This browser extension provides a user-friendly UI to connect to Elasticsearch databases via HTTP / HTTPS. Users can enter their Elasticsearch host, port, and credentials to explore databases, indexes, tables, and rows interactively.

## Features
- Connect to Elasticsearch using host, port, and credentials.
- Browse available databases and indexes.
- View tables and row data in a structured format.
- Interactive UI for seamless navigation.
- WebSocket support for real-time updates.

## Installation
1. Clone this repository:
   ```sh
   git clone <repository-url>
   ```
2. Navigate to the extension directory:
   ```sh
   cd <extension-folder>
   ```
3. Load the extension in your browser:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top-right corner)
   - Click "Load unpacked"
   - Select the extension folder

## Usage
1. Open the extension from the browser toolbar.
2. Enter the Elasticsearch host, port, and credentials.
3. Click "Connect" to fetch and display the database structure.
4. Navigate through the UI to explore tables and data.

## Requirements
- Elasticsearch instance (self-hosted or cloud-based)
- A modern Chromium-based browser (Chrome, Edge, Brave, etc.)

## Development
To modify and test the extension:
1. Make changes to the code as needed.
2. Reload the extension in `chrome://extensions/`.
3. Open the extension UI and verify the changes.

## Contributing
Feel free to submit issues or pull requests to improve functionality and UX.

## License
This project is licensed under the MIT License.

