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

import { DISCOVER_BRIDGE_PORT_PREFIX } from './bridge-wire'

export type DiscoverBridgeHost = {
    post: (data: unknown) => void
    isConnected: () => boolean
    dispose: () => void
}

/**
 * Extension-page side of the Discover iframe bridge. The ISOLATED content
 * script inside the iframe opens a chrome.runtime Port named
 * `pera-discover-bridge:<token>`; the token was stamped onto the iframe URL
 * by PWWebView.web, so the name routes the port to the right mount. Trust is
 * exact membership of the browser-stamped port.sender.origin in
 * `trustedOrigins` — same authority DappRequestRouter uses (dapp/router.ts).
 * Ports are the only bidirectional channel that works from a popup surface
 * (no tab id → no chrome.tabs.sendMessage). `trustedOrigins` is a list (not a
 * single origin) because a mounted URL can 302-redirect to a different host
 * before the port connects (e.g. Bidali → giftcards.* twin — see
 * trusted-iframe-origins.web.ts); membership is exact-match only, never a
 * suffix/pattern check.
 */
export const createDiscoverBridgeHost = (params: {
    token: string
    trustedOrigins: string[]
    onMessage: (data: unknown) => void
    onDisconnect?: () => void
}): DiscoverBridgeHost => {
    let activePort: chrome.runtime.Port | null = null

    const handleConnect = (port: chrome.runtime.Port): void => {
        if (port.name !== `${DISCOVER_BRIDGE_PORT_PREFIX}${params.token}`) {
            return // another mount's port — leave it alone
        }
        if (!params.trustedOrigins.includes(port.sender?.origin ?? '')) {
            console.warn(
                '[pera] discover bridge port rejected: origin mismatch',
            )
            port.disconnect()
            return
        }
        // A newer port for this token/origin (e.g. an iframe self-reload
        // reconnecting before the old port's disconnect event fires) takes
        // over here. The old port's listeners stay registered (chrome.runtime
        // gives no way to detach a specific callback pair), so both closures
        // below re-check `activePort === port` at fire time — a superseded
        // port's messages are ignored and its disconnect doesn't tear down
        // the connection the new port just established.
        activePort = port
        port.onMessage.addListener(data => {
            if (activePort !== port) return // superseded — ignore
            params.onMessage(data)
        })
        port.onDisconnect.addListener(() => {
            if (activePort !== port) return // stale disconnect — ignore
            activePort = null
            params.onDisconnect?.()
        })
    }

    chrome.runtime.onConnect.addListener(handleConnect)

    return {
        post: data => activePort?.postMessage(data),
        isConnected: () => activePort !== null,
        dispose: () => {
            chrome.runtime.onConnect.removeListener(handleConnect)
            activePort?.disconnect()
            activePort = null
        },
    }
}
