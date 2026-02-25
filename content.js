const STYLE_ID = 'cfa-yt-focus-mode-style';

function applyFocusMode(enabled) {
    let styleEl = document.getElementById(STYLE_ID);

    if (enabled) {
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            // Hide YouTube comments and suggested videos/sidebar
            styleEl.textContent = `
                ytd-comments { display: none !important; }
                #secondary { display: none !important; }
                #related { display: none !important; }
                ytd-watch-next-secondary-results-renderer { display: none !important; }
                #items.ytd-watch-next-secondary-results-renderer { display: none !important; }

                /* Center the main player and content, prevent stretching */
                ytd-watch-flexy[flexy] #columns.ytd-watch-flexy {
                    max-width: 1200px !important;
                    margin: 0 auto !important;
                    display: flex !important;
                    justify-content: center !important;
                }
                ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
                    min-width: 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    padding-right: 0 !important;
                    margin: 0 auto !important;
                }
            `;
            document.head.appendChild(styleEl);
        }
    } else {
        if (styleEl) {
            styleEl.remove();
        }
    }
}

// Check initial state
chrome.storage.local.get(['youtubeFocusMode'], (result) => {
    if (result.youtubeFocusMode) {
        applyFocusMode(true);
    }
});

// Listen for changes from the popup
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.youtubeFocusMode) {
        applyFocusMode(changes.youtubeFocusMode.newValue);
    }
});
