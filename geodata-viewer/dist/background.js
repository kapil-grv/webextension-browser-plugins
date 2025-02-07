/******/ (() => { // webpackBootstrap
/*!***************************!*\
  !*** ./src/background.js ***!
  \***************************/
let geoWindowId = null;

// Reset window ID if extension is reloaded
chrome.runtime.onStartup.addListener(() => {
    geoWindowId = null;
});

// Function to create the popup window
function createGeoPopup() {
    if (geoWindowId !== null) {
        chrome.windows.update(geoWindowId, { focused: true });
        return;
    }

    chrome.system.display.getInfo((displays) => {
        if (displays.length === 0) return;

        const primaryDisplay = displays[0];
        const screenWidth = primaryDisplay.workArea.width;
        const screenHeight = primaryDisplay.workArea.height;

        const width = 800;
        const height = 600;
        const left = Math.floor((screenWidth - width) / 2);
        const top = Math.floor((screenHeight - height) / 2);

        chrome.windows.create(
            {
                url: chrome.runtime.getURL("popup.html"),
                type: "popup",
                width,
                height,
                left,
                top
            },
            (window) => {
                if (window) {
                    geoWindowId = window.id;
                }
            }
        );
    });
}

// Ensure only one `onRemoved` listener is registered
chrome.windows.onRemoved.addListener((closedWindowId) => {
    if (closedWindowId === geoWindowId) {
        geoWindowId = null;
    }
});

// Listen for action icon click
chrome.action.onClicked.addListener(() => {
    createGeoPopup();
});

// Listen for messages from `popup.js`
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "open_popup") {
        createGeoPopup(); // Use existing function instead of creating a new window

        sendResponse({ status: "Popup opened" });
        return true; // Keep message port open for async response
    }
});

/******/ })()
;
//# sourceMappingURL=background.js.map