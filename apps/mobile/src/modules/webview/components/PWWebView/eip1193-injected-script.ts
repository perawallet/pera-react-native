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

import {
    DAPP_PAGE_TIMEOUT_MS,
    DAPP_QUEUED_PAGE_TIMEOUT_MS,
    EIP1193_ERROR_CODE,
    EIP1193_EVENT,
    EIP1193_METHOD,
    EIP1193_QUEUED_METHODS,
    PERA_EIP6963_ICON,
    PERA_EIP6963_NAME,
    PERA_EIP6963_RDNS,
} from '@perawallet/wallet-core-dapp/wire'
import { EIP1193_DELIVER_GLOBAL } from '../../utils/webViewDappTransport'
import { webViewScript } from '../../utils/webViewScript'

// ponytail: hand-written mirror of apps/browser/src/content/eip1193-main.ts,
// kept in step by hand (see docs/DAPP_BRIDGE.md). Installs only on https
// pages, and answers reach it through window[EIP1193_DELIVER_GLOBAL], never a
// `message` event the page's own listeners would see.
export const eip1193ProviderJS = (bridgeToken: string) => webViewScript`
(function setupPeraEip1193() {
    if (location.protocol !== 'https:') { return; }
    if (window.__peraEip1193Installed) { return; }
    window.__peraEip1193Installed = true;

    var TOKEN = ${bridgeToken};
    var METHOD = ${EIP1193_METHOD};
    var EVENT = ${EIP1193_EVENT};
    var ERROR_CODE = ${EIP1193_ERROR_CODE};
    var INFO = ${{
        name: PERA_EIP6963_NAME,
        rdns: PERA_EIP6963_RDNS,
        icon: PERA_EIP6963_ICON,
    }};
    // The extension's page backstops: native can drop an answer (the page
    // navigated, the app was killed), and a request that never settles would
    // also pin every later eth_requestAccounts to the same stuck promise.
    var TIMEOUT = ${{
        default: DAPP_PAGE_TIMEOUT_MS,
        queued: DAPP_QUEUED_PAGE_TIMEOUT_MS,
        queuedMethods: EIP1193_QUEUED_METHODS,
    }};
    // Same window as the extension: a gesture older than this no longer
    // counts, so a page cannot re-open the connect sheet in a loop. Unlike the
    // extension's isolated world, a WebView page shares this realm, so the
    // functions it would need to forge the flag are captured now, before page
    // scripts run; where injection lands late this is best-effort.
    var ACTIVATION_MS = 5000;
    var now = Date.now.bind(Date);
    var stringify = JSON.stringify.bind(JSON);
    var rnPost = null;
    // Captured now when the native bridge already exists; otherwise on first
    // use, which is as early as this script can see it.
    function captureBridge() {
        var bridge = window.ReactNativeWebView;
        if (bridge && typeof bridge.postMessage === 'function') {
            rnPost = bridge.postMessage.bind(bridge);
        }
    }
    captureBridge();
    function post(data) {
        if (!rnPost) { captureBridge(); }
        if (!rnPost) { return false; }
        rnPost(data);
        return true;
    }

    var lastGestureAt = -Infinity;
    function markGesture(event) {
        if (event.isTrusted) { lastGestureAt = now(); }
    }
    window.addEventListener('pointerdown', markGesture, true);
    window.addEventListener('keydown', markGesture, true);

    function providerError(code, message, data) {
        var error = new Error(message);
        error.name = 'Eip1193ProviderError';
        error.code = code;
        if (data !== undefined) { error.data = data; }
        return error;
    }

    var listeners = {};
    var accounts = [];
    var chainId = null;
    var hasAnnouncedConnect = false;
    var pending = {};
    var counter = 0;
    var requestAccountsInFlight = null;

    function emit(event, payload) {
        var set = listeners[event];
        if (!set) { return; }
        set.slice().forEach(function (listener) {
            try { listener(payload); } catch (_) {}
        });
    }
    function isSameList(a, b) {
        return a.length === b.length && a.every(function (item, index) { return item === b[index]; });
    }
    function setAccounts(next) {
        if (!Array.isArray(next) || !next.every(function (item) { return typeof item === 'string'; })) { return; }
        if (isSameList(accounts, next)) { return; }
        accounts = next.slice();
        emit(EVENT.accountsChanged, next.slice());
    }
    function setChainId(next, isNotification) {
        if (typeof next !== 'string' || next === chainId) { return; }
        var previous = chainId;
        chainId = next;
        if (isNotification || previous !== null) { emit(EVENT.chainChanged, next); }
    }
    function announceConnect(result) {
        if (hasAnnouncedConnect || typeof result !== 'string') { return; }
        hasAnnouncedConnect = true;
        emit(EVENT.connect, { chainId: result });
    }

    function send(method, params) {
        return new Promise(function (resolve, reject) {
            counter += 1;
            var id = 'pera-' + Math.random().toString(36).slice(2) + '-' + counter;
            var timeoutMs = TIMEOUT.queuedMethods.indexOf(method) !== -1 ? TIMEOUT.queued : TIMEOUT.default;
            var timer = setTimeout(function () {
                delete pending[id];
                reject(providerError(ERROR_CODE.disconnected, 'No response from wallet'));
            }, timeoutMs);
            pending[id] = { resolve: resolve, reject: reject, timer: timer };
            var isPosted = post(stringify({
                provider: 'eip1193',
                token: TOKEN,
                hasUserActivation: now() - lastGestureAt < ACTIVATION_MS,
                request: { jsonrpc: '2.0', id: id, method: method, params: params },
            }));
            if (!isPosted) {
                clearTimeout(timer);
                delete pending[id];
                reject(providerError(ERROR_CODE.disconnected, 'Pera is not reachable from this page'));
            }
        });
    }

    function request(args) {
        if (!args || typeof args !== 'object' || typeof args.method !== 'string') {
            return Promise.reject(providerError(ERROR_CODE.invalidParams, 'Expected { method, params? }'));
        }
        var method = args.method;
        var params = args.params;
        if (method === METHOD.requestAccounts) {
            if (requestAccountsInFlight) { return requestAccountsInFlight; }
            var inFlight = send(method, params).then(function (result) {
                setAccounts(result);
                return result;
            });
            requestAccountsInFlight = inFlight;
            var release = function () {
                if (requestAccountsInFlight === inFlight) { requestAccountsInFlight = null; }
            };
            inFlight.then(release, release);
            return inFlight;
        }
        return send(method, params).then(function (result) {
            if (method === METHOD.accounts) { setAccounts(result); }
            if (method === METHOD.chainId) {
                setChainId(result, false);
                announceConnect(result);
            }
            return result;
        });
    }

    var provider = {
        isPera: true,
        request: request,
        on: function (event, listener) {
            (listeners[event] = listeners[event] || []).push(listener);
            return provider;
        },
        removeListener: function (event, listener) {
            listeners[event] = (listeners[event] || []).filter(function (item) { return item !== listener; });
            return provider;
        },
    };

    function deliver(message) {
        if (!message || typeof message !== 'object') { return; }
        if (message.id === undefined) {
            if (message.method === EVENT.accountsChanged) { setAccounts(message.params); }
            else if (message.method === EVENT.chainChanged) { setChainId(message.params, true); }
            return;
        }
        var entry = pending[message.id];
        if (!entry) { return; }
        clearTimeout(entry.timer);
        delete pending[message.id];
        if (message.error) {
            entry.reject(providerError(message.error.code, message.error.message, message.error.data));
        } else {
            entry.resolve(message.result);
        }
    }
    try {
        Object.defineProperty(window, ${EIP1193_DELIVER_GLOBAL}, { value: deliver, configurable: true });
    } catch (_) {}

    if (!('ethereum' in window)) {
        try {
            Object.defineProperty(window, 'ethereum', {
                value: provider, writable: true, configurable: true, enumerable: true,
            });
        } catch (_) {}
    }

    function uuid() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') { return window.crypto.randomUUID(); }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
    }
    var detail = Object.freeze({
        info: Object.freeze({ uuid: uuid(), name: INFO.name, icon: INFO.icon, rdns: INFO.rdns }),
        provider: provider,
    });
    function announce() {
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: detail }));
    }
    window.addEventListener('eip6963:requestProvider', announce);
    announce();
})();
`
