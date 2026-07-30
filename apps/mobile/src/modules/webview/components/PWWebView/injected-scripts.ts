/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PERAWALLET_WC_SCHEME, WC_SCHEME } from '@hooks/deeplink/constants'

export const baseJS = `var css = '*{-webkit-touch-callout:none;-webkit-user-select:none}textarea,input{user-select:text;-webkit-user-select:text;}';
var head = document.head || document.getElementsByTagName('head')[0];
var style = document.createElement('style'); style.type = 'text/css';
style.appendChild(document.createTextNode(css)); head.appendChild(style);`

// Injected into the MAIN FRAME ONLY (react-native-webview's default for both
// injection points). The token closes over the per-load secret so every
// outbound message is stamped with it; native drops any message that arrives
// without the matching token (i.e. forged by a subframe that can't read this
// closure). See generateBridgeToken / hasValidBridgeToken.
//
// Runs at injectedJavaScriptBeforeContentLoaded and again in the document-end
// fallback bundle — the guard makes the second pass a no-op. A page
// pre-defining peraRPC only sabotages its own bridge (and at
// before-content-loaded time we run before any page script anyway).
export const peraMobileInterfaceJS = (bridgeToken: string) => `
console.log('peraMobileInterfaceJS setup');
(function setupPeraMobileInterface(){
if (window.peraRPC && window.peraMobileInterface) { return; }
var __peraBridgeToken = ${JSON.stringify(bridgeToken)};
function __stampToken(request) {
    var obj;
    try {
        obj = typeof request === 'string' ? JSON.parse(request) : (request || {});
    } catch (_) {
        obj = {};
    }
    // JSON-RPC batches arrive as arrays: stamp each element — a named
    // property set on the array itself is dropped by JSON.stringify, and
    // native requires the token on every batch element.
    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            if (obj[i] && typeof obj[i] === 'object') {
                obj[i].token = __peraBridgeToken;
            }
        }
    } else {
        obj.token = __peraBridgeToken;
    }
    return JSON.stringify(obj);
}
window.peraRPC = {
    sendJsonRPCMessage: (request) => {
        window.ReactNativeWebView?.postMessage(__stampToken(request));
    },
    sendRNMessage: (action, params = {}) => {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
            jsonrpc: '2.0',
            method: action,
            params,
            id: Date.now(),
            token: __peraBridgeToken
        }));
    },
};
window.peraMobileInterface = {
    version: '2',
    handleRequest: (request) => window.peraRPC.sendJsonRPCMessage(request),
    pushWebView: (params) => window.peraRPC.sendRNMessage('pushWebView', params),
    openSystemBrowser: (params) => window.peraRPC.sendRNMessage('openSystemBrowser', params),
    canOpenURI: (params) => window.peraRPC.sendRNMessage('canOpenURI', params),
    openNativeURI: (params) => window.peraRPC.sendRNMessage('openNativeURI', params),
    notifyUser: (params) => window.peraRPC.sendRNMessage('notifyUser', params),
    getAddresses: () => window.peraRPC.sendRNMessage('getAddresses'),
    getDeviceId: () => window.peraRPC.sendRNMessage('getDeviceId'),
    getSettings: () => window.peraRPC.sendRNMessage('getSettings'),
    getPublicSettings: () => window.peraRPC.sendRNMessage('getPublicSettings'),
    onBackPressed: () => window.peraRPC.sendRNMessage('onBackPressed'),
    logAnalyticsEvent: (params) => window.peraRPC.sendRNMessage('logAnalyticsEvent', params),
    closeWebView: () => window.peraRPC.sendRNMessage('closeWebView'),
    pushDappViewerScreen: (params) => window.peraRPC.sendRNMessage('pushWebView', JSON.parse(params)),

    // V1 function for backwards compatibility
    getAuthorizedAddresses: () => window.peraRPC.sendRNMessage('getAddresses'),
};
})();
`

export const peraConnectJS = `
    (function setupPeraConnect(){
        // Idempotency: this bundle runs at injectedJavaScriptBeforeContentLoaded
        // AND again as the document-end fallback. Re-running would re-wrap
        // window.open and attach a second modal observer with its own dedup
        // closure (= double-send). A page pre-setting this flag only disables
        // its own connect path — no security regression.
        if (window.__peraConnectInstalled) { return; }
        window.__peraConnectInstalled = true;

        // Cap forwarded URI length (real WC URIs are well under this; longer inputs are
        // either malformed or a hostile page trying to overload the RPC bridge).
        var MAX_URI_LENGTH = 4096;
        // Drop the same URI if it's already been sent within this window.
        var DEDUP_WINDOW_MS = 2000;
        var lastUri = '';
        var lastUriAt = 0;

        function isWcUri(s) {
            return typeof s === 'string'
                && s.length > 0
                && s.length <= MAX_URI_LENGTH
                && (s.indexOf('${WC_SCHEME}:') === 0 || s.indexOf('${PERAWALLET_WC_SCHEME}:') === 0);
        }
        function sendUri(uri) {
            if (!isWcUri(uri)) return false;
            var now = Date.now();
            if (uri === lastUri && (now - lastUriAt) < DEDUP_WINDOW_MS) return true;
            // The dedup window exists to stop RPC flooding, not to eat
            // retries: stamp it only after the send actually went through.
            // A failed send returns false, so processModals leaves the dApp's
            // modal in place and an immediate same-URI retry isn't dropped.
            if (!window.peraRPC || typeof window.peraRPC.sendRNMessage !== 'function') return false;
            try { window.peraRPC.sendRNMessage('walletConnect', { uri: uri }); } catch (_) { return false; }
            lastUri = uri;
            lastUriAt = now;
            return true;
        }
        function extractUriFromConnectModal(wrapper) {
            if (!wrapper) return null;
            // Current (@perawallet/connect >=1.3): the wc URI is set as the 'uri' attribute
            // on the <pera-wallet-connect-modal> custom element itself (with '&algorand=true' appended).
            var modal = wrapper.querySelector('pera-wallet-connect-modal');
            if (modal) {
                var attr = modal.getAttribute('uri');
                if (isWcUri(attr)) return attr;
                // Legacy: a launch button nested inside touch-screen-mode shadow DOM.
                try {
                    if (modal.shadowRoot) {
                        var touch = modal.shadowRoot.querySelector('pera-wallet-modal-touch-screen-mode');
                        if (touch && touch.shadowRoot) {
                            var btn = touch.shadowRoot.querySelector(
                                '#pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button'
                            );
                            var href = btn && btn.getAttribute('href');
                            if (isWcUri(href)) return href;
                        }
                    }
                } catch (_) {}
            }
            // Legacy: class-based fallback (pre-shadow-DOM versions).
            var legacy = wrapper.getElementsByClassName(
                'pera-wallet-connect-modal-touch-screen-mode__launch-pera-wallet-button'
            );
            if (legacy && legacy[0]) {
                var legacyHref = legacy[0].getAttribute('href');
                if (isWcUri(legacyHref)) return legacyHref;
            }
            return null;
        }
        function processModals() {
            // Redirect modal: its launch link has no wc URI (it just opens 'perawallet-wc://?browser=...'),
            // and the SDK fires that window.open on insert anyway. Suppress it; window.open hook below
            // catches the URI-bearing deep link from the connect path.
            var redirect = document.getElementById('pera-wallet-redirect-modal-wrapper');
            if (redirect) redirect.remove();

            var connect = document.getElementById('pera-wallet-connect-modal-wrapper');
            if (connect) {
                var uri = extractUriFromConnectModal(connect);
                if (sendUri(uri)) {
                    connect.remove();
                }
            }
        }

        // Hook window.open: when @perawallet/connect detects it's running inside a webview
        // it skips the modal entirely and calls window.open(perawallet-wc://wc?uri=<encoded>...)
        // (iOS) or window.open('wc:...') (Android). This is the primary path inside Pera's webview.
        try {
            var originalOpen = window.open;
            window.open = function(url) {
                if (isWcUri(url) && sendUri(url)) {
                    return null;
                }
                return originalOpen.apply(window, arguments);
            };
        } catch (_) {}

        function attachModalObserver() {
            try {
                var observer = new MutationObserver(processModals);
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (_) {}
            // Also run once in case the modal was inserted before the observer attached.
            processModals();
        }
        // At before-content-loaded time there is no <body> yet — defer the
        // observer to DOMContentLoaded. The window.open hook above is the
        // piece that must exist pre-DOM.
        if (document.body) { attachModalObserver(); }
        else { document.addEventListener('DOMContentLoaded', attachModalObserver, { once: true }); }
    })();
`
