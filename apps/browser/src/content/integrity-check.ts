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
    INTEGRITY_CHECK_MESSAGE_TYPE,
    INTEGRITY_CHECK_PORT_PREFIX,
    INTEGRITY_CHECK_TOKEN_PARAM,
    INTEGRITY_CHECK_VERSION,
    INTEGRITY_FRAME_MESSAGE_TYPE,
    frameEventFor,
    isCheckToken,
    parseCheckPageMessage,
    toCheckPortMessage,
    type IntegrityCheckPortMessage,
    type IntegrityFrameEvent,
} from '@perawallet/wallet-extension-platform-chrome'

// The check page cannot reach chrome.runtime, so this relays its window
// messages to the worker and tells the hosting extension page when to expand
// or remove the frame. A page opened without a check token was opened by
// someone other than the extension, so the relay stays silent.
export const runIntegrityCheckRelay = (): void => {
    const token = new URLSearchParams(window.location.search).get(
        INTEGRITY_CHECK_TOKEN_PARAM,
    )
    if (!isCheckToken(token)) return

    // Not `new URL(chrome.runtime.getURL('')).origin`: WHATWG URL treats
    // chrome-extension: as a non-special scheme and serializes its origin as
    // the literal string "null". getURL('') always ends in a bare '/', so
    // stripping it is the origin.
    const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '')
    const isFramed = window.top !== window
    let port: chrome.runtime.Port | null = null
    let announcement: IntegrityCheckPortMessage | null = null

    // An idle worker is evicted after 30 seconds, which drops this port
    // mid-solve. Reconnecting wakes it, and re-announcing tells it the page is
    // still alive before anything else arrives.
    const connect = (): chrome.runtime.Port => {
        const next = chrome.runtime.connect({
            name: `${INTEGRITY_CHECK_PORT_PREFIX}${token}`,
        })
        next.onDisconnect.addListener(() => {
            if (port === next) port = null
        })
        port = next
        if (announcement) next.postMessage(announcement)
        return next
    }

    const send = (message: IntegrityCheckPortMessage): void => {
        try {
            ;(port ?? connect()).postMessage(message)
        } catch {
            // Posting on a port the browser already closed throws.
            port = null
            connect().postMessage(message)
        }
    }

    const notifyHost = (event: IntegrityFrameEvent): void => {
        if (!isFramed) return
        // Addressed to the extension's origin, so a site framing the check
        // page learns nothing.
        window.parent.postMessage(
            {
                type: INTEGRITY_FRAME_MESSAGE_TYPE,
                v: INTEGRITY_CHECK_VERSION,
                event,
            },
            extensionOrigin,
        )
    }

    window.addEventListener('message', event => {
        if (event.source !== window) return
        if (event.origin !== window.location.origin) return
        const message = parseCheckPageMessage(event.data)
        if (!message) return

        if (message.event === 'hello') {
            window.postMessage(
                {
                    type: INTEGRITY_CHECK_MESSAGE_TYPE,
                    v: INTEGRITY_CHECK_VERSION,
                    event: 'ready',
                },
                window.location.origin,
            )
            announcement = toCheckPortMessage(message)
            if (port) port.postMessage(announcement)
            else connect()
            return
        }

        send(toCheckPortMessage(message))
        const frameEvent = frameEventFor(message)
        if (frameEvent) notifyHost(frameEvent)
    })
}

runIntegrityCheckRelay()
