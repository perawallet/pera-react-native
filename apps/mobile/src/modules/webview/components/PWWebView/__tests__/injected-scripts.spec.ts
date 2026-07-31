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

// Executes the real injected bridge script and round-trips its output through
// the native-side validator, so the token producer and consumer are tested
// against each other — a stamping bug that the validator rejects (e.g. batch
// arrays losing the token) fails here.

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { peraConnectJS, peraMobileInterfaceJS } from '../injected-scripts'
import { hasValidBridgeToken } from '../../../hooks/handlers'

const TOKEN = 'test-bridge-token-123'

type BridgeWindow = typeof window & {
    ReactNativeWebView?: { postMessage: (data: string) => void }
    peraRPC?: {
        sendJsonRPCMessage: (request: unknown) => void
        sendRNMessage: (action: string, params?: unknown) => void
    }
    peraMobileInterface?: {
        getDeviceId: () => void
    }
    __peraConnectInstalled?: boolean
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
        delete bridgeWindow.peraMobileInterface
    })

    it('exposes getDeviceId, which posts a getDeviceId request the Discover web app can call', () => {
        bridgeWindow.peraMobileInterface?.getDeviceId()

        const posted = lastPostedMessage(postMessage)
        expect(posted).toMatchObject({ method: 'getDeviceId', token: TOKEN })
        expect(hasValidBridgeToken(posted, TOKEN)).toBe(true)
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

describe('peraConnectJS wc-uri interception', () => {
    const WC_URI = 'wc:topic-a@1?bridge=https%3A%2F%2Fbridge.example.org&key=ab'
    const WC_URI_B =
        'wc:topic-b@1?bridge=https%3A%2F%2Fbridge.example.org&key=cd'

    let postMessage: Mock<(data: string) => void>
    let originalOpen: typeof window.open

    // eslint-disable-next-line no-new-func
    const installBridge = () => new Function(peraMobileInterfaceJS(TOKEN))()
    // eslint-disable-next-line no-new-func
    const installConnect = () => new Function(peraConnectJS)()

    const walletConnectPosts = () =>
        postMessage.mock.calls
            .map(call => JSON.parse(call[0] as string))
            .filter(msg => msg.method === 'walletConnect')

    const insertConnectModal = (uri: string) => {
        const wrapper = document.createElement('div')
        wrapper.id = 'pera-wallet-connect-modal-wrapper'
        const modal = document.createElement('pera-wallet-connect-modal')
        modal.setAttribute('uri', uri)
        wrapper.appendChild(modal)
        document.body.appendChild(wrapper)
        return wrapper
    }

    beforeEach(() => {
        postMessage = vi.fn()
        bridgeWindow.ReactNativeWebView = { postMessage }
        originalOpen = window.open
    })

    afterEach(() => {
        window.open = originalOpen
        delete bridgeWindow.ReactNativeWebView
        delete bridgeWindow.peraRPC
        delete bridgeWindow.peraMobileInterface
        delete bridgeWindow.__peraConnectInstalled
        document.getElementById('pera-wallet-connect-modal-wrapper')?.remove()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('installs pre-DOM and still scrapes modals inserted after DOMContentLoaded', async () => {
        // before-content-loaded time: no <body> yet. The window.open hook
        // must install anyway; the modal observer must defer, not die.
        const bodySpy = vi
            .spyOn(document, 'body', 'get')
            .mockReturnValue(null as unknown as HTMLElement)

        expect(() => {
            installBridge()
            installConnect()
        }).not.toThrow()

        expect(window.open(WC_URI)).toBeNull()
        expect(walletConnectPosts()).toHaveLength(1)

        bodySpy.mockRestore()
        document.dispatchEvent(new Event('DOMContentLoaded'))
        insertConnectModal(WC_URI_B)

        await vi.waitFor(() => {
            expect(
                walletConnectPosts().some(msg => msg.params.uri === WC_URI_B),
            ).toBe(true)
            expect(
                document.getElementById('pera-wallet-connect-modal-wrapper'),
            ).toBeNull()
        })
    })

    it('forwards the uri as a token-stamped walletConnect message', () => {
        installBridge()
        installConnect()

        window.open(WC_URI)

        const [posted] = walletConnectPosts()
        expect(posted).toMatchObject({
            method: 'walletConnect',
            params: { uri: WC_URI },
            token: TOKEN,
        })
        expect(hasValidBridgeToken(posted, TOKEN)).toBe(true)
    })

    it('does not burn the dedup window when the bridge is missing', () => {
        // The bridge script failed/hasn't run: sendUri must NOT stamp the
        // dedup state on a send that went nowhere — the dApp's immediate
        // retry (same uri) has to go through once the bridge exists.
        installConnect()

        window.open(WC_URI)
        expect(walletConnectPosts()).toHaveLength(0)

        installBridge()
        window.open(WC_URI)

        expect(walletConnectPosts()).toHaveLength(1)
    })

    it('dedupes an identical uri within the window, then allows it after expiry', () => {
        vi.useFakeTimers()
        installBridge()
        installConnect()

        window.open(WC_URI)
        window.open(WC_URI)
        expect(walletConnectPosts()).toHaveLength(1)

        vi.advanceTimersByTime(2001)
        window.open(WC_URI)
        expect(walletConnectPosts()).toHaveLength(2)
    })

    it('is idempotent across both injection points', () => {
        // The bundle runs at injectedJavaScriptBeforeContentLoaded AND again
        // as the document-end fallback — the second pass must be a no-op,
        // not a second window.open wrapper with its own dedup closure.
        installBridge()
        installConnect()
        const wrappedOpen = window.open

        installBridge()
        installConnect()

        expect(window.open).toBe(wrappedOpen)

        window.open(WC_URI)
        expect(walletConnectPosts()).toHaveLength(1)
    })
})
