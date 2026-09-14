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

// Content scripts land in every user tab and share chrome.runtime.onMessage with
// the extension's own pages. Their sender.url is the injected WEB PAGE, so gating
// on the extension origin separates our pages from scripts we shipped into every
// tab; sender.id guards against a spoofed cross-extension sender. The service
// worker is served from the same origin, so its messages pass without special-casing.
export const isTrustedExtensionPageSender = (
    sender: chrome.runtime.MessageSender | undefined,
    chromeLike: typeof chrome = chrome,
): boolean => {
    if (!sender?.url) return false
    if (sender.id !== chromeLike.runtime.id) return false
    return sender.url.startsWith(chromeLike.runtime.getURL(''))
}
