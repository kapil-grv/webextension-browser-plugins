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
