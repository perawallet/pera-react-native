/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Threat model: content scripts land in every user tab and share
// chrome.runtime.onMessage with the rest of the extension (popup, expanded
// tab, approval window, offscreen document, service worker). A content
// script's sender.url is the WEB PAGE it was injected into (e.g.
// https://dapp.example) — never an extension-origin URL — so gating on the
// extension's own chrome-extension://<id>/ origin is what separates "one of
// our own pages" from "a script we shipped into every user tab." sender.id
// additionally guards against a spoofed cross-extension sender. The service
// worker's own script is also served from chrome.runtime.getURL(''), so this
// check admits SW-originated messages (pings/execs) with no special-casing.
export const isTrustedExtensionPageSender = (
    sender: chrome.runtime.MessageSender | undefined,
    chromeLike: typeof chrome = chrome,
): boolean => {
    if (!sender?.url) return false
    if (sender.id !== chromeLike.runtime.id) return false
    return sender.url.startsWith(chromeLike.runtime.getURL(''))
}
