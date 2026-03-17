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
                #bottom-row,
                #player-full-bleed-container { 
                    display: none !important; 
                }

                /* --- 2. GLOBAL BACKGROUND --- */
                html, body, ytd-app {
                    background-color: #020617 !important;
                    --ytd-masthead-height: 0px !important; 
                    overflow: hidden !important; 
                    height: 100vh !important;
                    width: 100vw !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                ytd-page-manager {
                    margin-top: 0 !important;
                    height: 100vh !important;
                    overflow: hidden !important;
                }

                /* --- 3. FORCE PERFECT CENTERING --- */
                /* Detach the primary container and pin it to the dead center of the screen */
                #primary-inner {
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 100vw !important;
                    z-index: 9999 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                /* --- 4. VIDEO SIZING & RATIO --- */
                #player-container-outer, 
                #player-container-inner, 
                #player-container, 
                #ytd-player {
                    position: relative !important; /* Overrides YT's inline absolute positioning */
                    width: 100vw !important;
                    max-width: calc((100vh - 100px) * 16 / 9) !important;
                    height: auto !important;
                    aspect-ratio: 16 / 9 !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    border-radius: 0 !important;
                }

                .html5-video-player {
                    width: 100% !important;
                    height: 100% !important;
                }

                .html5-video-container, 
                .html5-video-container video {
                    width: 100% !important;
                    height: 100% !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    border-radius: 0 !important;
                }

                /* --- 5. THE GLOW EFFECT --- */
                #ytd-player {
                    box-shadow: 
                        0 0 60px 10px rgba(56, 189, 248, 0.15),
                        0 0 150px 40px rgba(15, 23, 42, 0.50),
                        0 0 300px 100px rgba(11, 40, 42, 0.40) !important;
                }

                /* --- 6. CLEAN UP BELOW THE VIDEO (JUST TITLE NOW) --- */
                #below {
                    width: 100% !important;
                    margin-top: 20px !important;
                    display: flex !important;
                    justify-content: center !important;
                    flex-direction: column !important;
                    align-items: center !important;
                }

                #above-the-fold {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 100% !important;
                }

                #title h1 {
                    font-size: clamp(1rem, 2.5vw, 1.4rem) !important;
                    color: #e2e8f0 !important; 
                    font-weight: 500 !important;
                    margin: 0 !important;
                    line-height: 1.3 !important;
                    text-align: center !important;
                    width: 100% !important;
                    padding: 0 15px !important;
                    box-sizing: border-box !important;
                    display: -webkit-box !important;
                    -webkit-line-clamp: 2 !important;
                    -webkit-box-orient: vertical !important;
                    overflow: hidden !important;
                }
            `;
            document.head.appendChild(styleEl);

            // Force YouTube to recalculate the player layout for Focus Mode
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
        }
    } else {
        if (styleEl) {
            styleEl.remove();

            // Force YouTube to recalculate the player layout back to normal
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
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