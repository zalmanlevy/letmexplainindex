const STYLE_ID = 'cfa-yt-focus-mode-style';

function applyFocusMode(enabled) {
    let styleEl = document.getElementById(STYLE_ID);

    if (enabled) {
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;

            styleEl.textContent = `
                /* --- 1. HIDE ALL DISTRACTIONS --- */
                #masthead-container, 
                #secondary, 
                ytd-comments, 
                #related, 
                ytd-watch-next-secondary-results-renderer,
                #items.ytd-watch-next-secondary-results-renderer,
                ytd-live-chat-frame,
                #owner, 
                #actions, 
                #actions-inner, 
                #top-row ytd-video-owner-renderer,
                #description,
                #bottom-row { 
                    display: none !important; 
                }

                /* --- 2. GLOBAL BACKGROUND --- */
                html, body, ytd-app {
                    background-color: #020617 !important;
                    --ytd-masthead-height: 0px !important; 
                }

                ytd-page-manager {
                    margin-top: 0 !important;
                }

                /* --- 3. FORCE PROPORTIONAL VIDEO SIZE --- */
                ytd-watch-flexy {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    min-height: 100vh !important;
                    background: #020617 !important;
                }

                ytd-watch-flexy[flexy] #columns.ytd-watch-flexy {
                    margin: 0 auto !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                }

                ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
                    padding: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                }

                /* Lock height and force a strict 16:9 aspect ratio */
                #player-container-outer, 
                #player-container-inner, 
                #player-container, 
                #ytd-player,
                .html5-video-player {
                    height: 90vh !important; 
                    width: auto !important; /* Let the aspect ratio dictate the width */
                    aspect-ratio: 16 / 9 !important;
                    max-width: 96vw !important; /* Safety cap for narrow screens */
                    margin: 0 auto !important;
                    border-radius: 12px !important;
                    overflow: visible !important; 
                }

                .html5-video-container, 
                .html5-video-container video {
                    width: 100% !important;
                    height: 100% !important;
                    border-radius: 12px !important;
                }

                /* --- 4. THE GLOW EFFECT --- */
                #ytd-player {
                    box-shadow: 
                        0 0 60px 10px rgba(56, 189, 248, 0.15),
                        0 0 150px 40px rgba(15, 23, 42, 0.50),
                        0 0 300px 100px rgba(11, 40, 42, 0.40) !important;
                    z-index: 10;
                }

                /* --- 5. CLEAN UP BELOW THE VIDEO (JUST TITLE NOW) --- */
                #below {
                    width: 100% !important;
                    margin-top: 30px !important;
                    display: flex !important;
                    justify-content: center !important;
                }

                #above-the-fold {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 100% !important;
                }

                #title h1 {
                    font-size: 1.4rem !important;
                    color: #e2e8f0 !important; 
                    font-weight: 500 !important;
                    margin: 0 !important;
                    line-height: 1.2 !important;
                    text-align: center !important;
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