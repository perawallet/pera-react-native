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

// Executes the real injected bridge script and round-trips its output through
// the native-side validator, so the token producer and consumer are tested
// against each other — a stamping bug that the validator rejects (e.g. batch
// arrays losing the token) fails here.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { peraMobileInterfaceJS } from '../injected-scripts'
import { hasValidBridgeToken } from '../../../hooks/handlers'

const TOKEN = 'test-bridge-token-123'

type BridgeWindow = typeof window & {
    ReactNativeWebView?: { postMessage: (data: string) => void }
    peraRPC?: {
        sendJsonRPCMessage: (request: unknown) => void
        sendRNMessage: (action: string, params?: unknown) => void
    }
}

const bridgeWindow = window as BridgeWindow

const lastPostedMessage = (
    postMessage: Mock<(data: string) => void>,
): unknown => JSON.parse(postMessage.mock.calls.at(-1)?.[0] as string)

describe('peraMobileInterfaceJS token stamping', () => {
    let postMessage: Mock<(data: string) => void>

    beforeEach(() => {
        postMessage = vi.fn()
        bridgeWindow.ReactNativeWebView = { postMessage }
        // eslint-disable-next-line no-new-func
        new Function(peraMobileInterfaceJS(TOKEN))()
    })

    afterEach(() => {
        delete bridgeWindow.ReactNativeWebView
        delete bridgeWindow.peraRPC
    })

    it('stamps a single JSON-RPC request and passes validation', () => {
        bridgeWindow.peraRPC?.sendJsonRPCMessage(
            JSON.stringify({ jsonrpc: '2.0', method: 'getAddresses', id: 1 }),
        )

        const posted = lastPostedMessage(postMessage)
        expect(posted).toMatchObject({ method: 'getAddresses', token: TOKEN })
        expect(hasValidBridgeToken(posted, TOKEN)).toBe(true)
    })

    it('stamps every element of a JSON-RPC batch and passes validation', () => {
        bridgeWindow.peraRPC?.sendJsonRPCMessage(
            JSON.stringify([
                { jsonrpc: '2.0', method: 'getAddresses', id: 1 },
                { jsonrpc: '2.0', method: 'getSettings', id: 2 },
            ]),
        )

        const posted = lastPostedMessage(postMessage) as Array<{
            token?: string
        }>
        expect(Array.isArray(posted)).toBe(true)
        expect(posted).toHaveLength(2)
        posted.forEach(entry => expect(entry.token).toBe(TOKEN))
        expect(hasValidBridgeToken(posted, TOKEN)).toBe(true)
    })

    it('stamps sendRNMessage actions and passes validation', () => {
        bridgeWindow.peraRPC?.sendRNMessage('closeWebView')

        const posted = lastPostedMessage(postMessage)
        expect(posted).toMatchObject({ method: 'closeWebView', token: TOKEN })
        expect(hasValidBridgeToken(posted, TOKEN)).toBe(true)
    })

    it('rejects a stamped message checked against a different token', () => {
        bridgeWindow.peraRPC?.sendJsonRPCMessage(
            JSON.stringify({ jsonrpc: '2.0', method: 'getAddresses', id: 1 }),
        )

        expect(
            hasValidBridgeToken(lastPostedMessage(postMessage), 'other-token'),
        ).toBe(false)
    })
})
