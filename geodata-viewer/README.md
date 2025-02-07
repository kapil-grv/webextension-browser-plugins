# GeoData Viewer

GeoData Viewer is a browser extension that allows users to load and visualize geospatial data directly in their browser. It supports rendering GeoJSON, CSV, and all other formats supported by DuckDB on interactive maps, making it a useful tool for GIS professionals, developers, and researchers.

## Features
- Load and display geospatial data in the browser.
- Supports **GeoJSON** format for visualization.
- Integrates **Leaflet.js** for interactive map rendering.
- Works seamlessly with DuckDB for efficient geospatial data processing.
- Provides customizable map layers and styles.
- Easy-to-use interface with popups displaying feature attributes.

## Installation
### From Chrome Web Store (Recommended)
1. Go to the [Chrome Web Store](https://chrome.google.com/webstore/).
2. Search for **GeoData Viewer**.
3. Click **Add to Chrome** and confirm the installation.

### Manual Installation (Developer Mode)
1. Clone this repository or download the ZIP file.
2. Open **Chrome** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the extension folder.

## Usage
1. Click on the extension icon in the browser toolbar.
2. Select a GeoJSON file or connect to a geospatial database.
3. The map will render the data, allowing for zooming, panning, and feature inspection.
4. Click on map features to view detailed attribute information in a popup.

## Permissions
This extension requests the following permissions:
- **windows**: To open dedicated map visualization windows.
- **system.display**: To optimize rendering for different screen sizes.
- **host permissions**: To access data from any URL (`<all_urls>`).

## Development
### Prerequisites
- **Node.js** and **npm** (for managing dependencies)
- A modern browser (Chrome or Edge)

### Setup
```sh
git clone https://github.com/kapil-grv/webextension-browser-plugins.git
cd geodata-viewer
npm install
```

### Running in Development Mode
1. Build the extension:
   ```sh
   npm run build
   ```
2. Load the `dist/` folder as an unpacked extension in Chrome (`chrome://extensions/`).

## Contributing
Contributions are welcome! Feel free to submit a pull request or report issues.

## License
This project is licensed under the **MIT License**.

## Contact
- **Developer**: Kapil Gauravan V
- **Website**: [kapilgrv.in](https://kapilgrv.in)
- **GitHub**: [kapil-grv](https://github.com/kapil-grv)

