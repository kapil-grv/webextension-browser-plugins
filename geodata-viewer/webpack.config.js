const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        mode: isProduction ? 'production' : 'development',
        entry: {
            popup: './src/popup.js',
            background: './src/background.js'
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].js',
            clean: true
        },
        plugins: [
            new CopyPlugin({
                patterns: [
                    { from: "src/manifest.json", to: "manifest.json" },
                    { from: "src/popup.html", to: "popup.html" },
                    { from: "src/icons/3.png", to: "icon.png" },
                    { from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", to: "lib/duckdb-mvp.wasm" },
                    { from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", to: "lib/duckdb-eh.wasm" },
                    { from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js", to: "lib/duckdb-browser-mvp.worker.js" },
                    { from: "node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js", to: "lib/duckdb-browser-eh.worker.js" },
                    { from: "node_modules/leaflet/dist/leaflet.css", to: "lib/leaflet.css" },
                    { from: "node_modules/leaflet/dist/images", to: "lib/images" }
                ]
            })
        ],
        devtool: isProduction ? 'source-map' : 'cheap-module-source-map'
    };
};
