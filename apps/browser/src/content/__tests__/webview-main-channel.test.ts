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

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    WEBVIEW_BRIDGE_HANDSHAKE_EVENT,
    WEBVIEW_BRIDGE_RELAY_READY_EVENT,
    type DiscoverChannelHandshake,
} from '@perawallet/wallet-extension-platform-chrome'
import { connectWebviewMainChannel } from '../webview-main-channel'

const TOKEN = 'main-channel-token-1'

// connectWebviewMainChannel registers a persistent
// WEBVIEW_BRIDGE_RELAY_READY_EVENT listener on `window`, and jsdom keeps one
// shared `window` across every test in this file — track every listener each
// test adds and detach it afterward so tests don't leak into each other (same
// workaround bidali-main.test.ts uses for its 'message' listener).
let addedListeners: Array<[string, EventListenerOrEventListenerObject]>

const captureHandshakes = (): DiscoverChannelHandshake[] => {
    const captured: DiscoverChannelHandshake[] = []
    window.addEventListener(WEBVIEW_BRIDGE_HANDSHAKE_EVENT, event => {
        captured.push((event as CustomEvent<DiscoverChannelHandshake>).detail)
    })
    return captured
}

beforeEach(() => {
    window.history.replaceState(null, '', `/?peraBridgeToken=${TOKEN}`)
    addedListeners = []
    const realAddEventListener = window.addEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation(
        (type, listener, options) => {
            addedListeners.push([type, listener])
            realAddEventListener(type, listener, options)
        },
    )
})

afterEach(() => {
    vi.restoreAllMocks()
    addedListeners.forEach(([type, listener]) =>
        window.removeEventListener(type, listener),
    )
})

describe('connectWebviewMainChannel', () => {
    it('returns null and dispatches nothing without the bridge token param', () => {
        window.history.replaceState(null, '', '/')
        const captured = captureHandshakes()

        expect(connectWebviewMainChannel('disc')).toBeNull()
        expect(captured).toHaveLength(0)
    })

    it('returns the token and builds prefixed, per-call event names', () => {
        const captured = captureHandshakes()
        const channel = connectWebviewMainChannel('disc')

        expect(channel?.token).toBe(TOKEN)
        expect(captured).toHaveLength(1)
        expect(captured[0]?.requestEventName).toMatch(/^__pera_disc_req_\w+__$/)
        expect(captured[0]?.responseEventName).toMatch(
            /^__pera_disc_res_\w+__$/,
        )
    })

    it('uses the given prefix so distinct callers get distinct event names', () => {
        const discCaptured = captureHandshakes()
        connectWebviewMainChannel('disc')
        const bidaliCaptured = captureHandshakes()
        connectWebviewMainChannel('bidali')

        expect(discCaptured[0]?.requestEventName).toMatch(/^__pera_disc_req_/)
        expect(bidaliCaptured[0]?.requestEventName).toMatch(
            /^__pera_bidali_req_/,
        )
    })

    it('re-dispatches the handshake when the ISOLATED relay announces readiness', () => {
        const captured = captureHandshakes()
        connectWebviewMainChannel('disc')
        expect(captured).toHaveLength(1)

        window.dispatchEvent(new CustomEvent(WEBVIEW_BRIDGE_RELAY_READY_EVENT))
        expect(captured).toHaveLength(2)
        expect(captured[1]).toEqual(captured[0])
    })

    it('relay() dispatches the message under the handshake requestEventName', () => {
        const channel = connectWebviewMainChannel('disc')
        const captured = captureHandshakes()
        window.dispatchEvent(new CustomEvent(WEBVIEW_BRIDGE_RELAY_READY_EVENT))
        const requestEventName = captured[0]?.requestEventName as string

        const received: unknown[] = []
        window.addEventListener(requestEventName, event =>
            received.push((event as CustomEvent).detail),
        )
        channel?.relay({ method: 'getSettings' })

        expect(received).toEqual([{ method: 'getSettings' }])
    })
})
