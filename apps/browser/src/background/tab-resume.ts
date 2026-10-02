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

import { isTabResumeDoneMessage } from '@perawallet/wallet-core-browser-runtime'

/**
 * Closes a tab that finished a flow handed over from the toolbar popup and
 * reopens the popup in its window. Done here because a page that closes its own
 * tab dies before it could open the popup; `openPopup` needs no user gesture
 * from the worker.
 *
 * Only an extension `expanded.html` tab may ask: content scripts share this
 * message channel, and their `sender.url` is the web page they run in.
 */
export const installTabResumeRoute = ({
    chromeLike = chrome,
}: {
    chromeLike?: typeof chrome
}): void => {
    const expandedUrl = chromeLike.runtime.getURL('expanded.html')

    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            // Always a synchronous `false`: onMessage is shared with other
            // listeners, and a truthy return would make chrome await a response.
            if (!isTabResumeDoneMessage(message)) return false
            if (sender.id !== chromeLike.runtime.id) return false
            if (!sender.url?.startsWith(expandedUrl)) return false
            const tabId = sender.tab?.id
            if (tabId === undefined) return false
            const windowId = sender.tab?.windowId
            // Answered before closing: an unanswered sendMessage rejects in the tab.
            sendResponse({ ok: true })

            void (async () => {
                await chromeLike.tabs.remove(tabId)
                try {
                    await chromeLike.action.openPopup({ windowId })
                } catch {
                    // The tab was its window's last: the popup opens wherever the
                    // browser is now focused, or not at all if nothing is.
                    await chromeLike.action.openPopup().catch(() => undefined)
                }
            })().catch((error: unknown) => {
                console.warn('[pera] closing the resume tab failed:', error)
            })
            return false
        },
    )
}
