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

import { describe, expect, it, vi } from 'vitest'
import {
    EIP1193_DELIVER_GLOBAL,
    createWebViewDappTransport,
    isEip1193PageMessage,
    type Eip1193PageMessage,
    type WebViewDappPage,
} from '../webViewDappTransport'

const ORIGIN = 'https://app.uniswap.org'

const pageAt = (url: string) => {
    const state = { url }
    const inject = vi.fn()
    const page: WebViewDappPage = { currentUrl: () => state.url, inject }
    return { page, inject, state }
}

const messageOf = (
    overrides: Partial<Eip1193PageMessage> = {},
): Eip1193PageMessage => ({
    provider: 'eip1193',
    token: 't',
    hasUserActivation: true,
    request: { jsonrpc: '2.0', id: 'r1', method: 'eth_chainId' },
    ...overrides,
})

const injectedOf = (inject: ReturnType<typeof vi.fn>): string =>
    inject.mock.calls.map(call => String(call[0])).join('\n')

describe('webViewDappTransport', () => {
    it('hands the listener the origin the posting frame reported, not one the payload claims', () => {
        const transport = createWebViewDappTransport()
        const { page } = pageAt(`${ORIGIN}/swap`)
        const listener = vi.fn()
        transport.onRequest(listener)

        transport.receive(
            page,
            messageOf({ hasUserActivation: false }),
            `${ORIGIN}/swap?x=1`,
        )

        expect(listener).toHaveBeenCalledWith(
            { origin: ORIGIN, hasUserActivation: false },
            expect.objectContaining({ method: 'eth_chainId' }),
            expect.any(Function),
        )
    })

    it('answers 4100 and skips the listener for a page that is not https', () => {
        const transport = createWebViewDappTransport()
        const { page, inject } = pageAt('http://evil.example/')
        const listener = vi.fn()
        transport.onRequest(listener)

        transport.receive(page, messageOf(), 'http://evil.example/')

        expect(listener).not.toHaveBeenCalled()
        expect(injectedOf(inject)).toContain('4100')
    })

    it('answers -32602 for a request over the payload cap', () => {
        const transport = createWebViewDappTransport()
        const { page, inject } = pageAt(ORIGIN)
        const listener = vi.fn()
        transport.onRequest(listener)

        transport.receive(
            page,
            messageOf({
                request: {
                    jsonrpc: '2.0',
                    id: 'r1',
                    method: 'eth_sendTransaction',
                    params: ['x'.repeat(1_100_000)],
                },
            }),
            ORIGIN,
        )

        expect(listener).not.toHaveBeenCalled()
        expect(injectedOf(inject)).toContain('-32602')
    })

    it('answers 4900 when no handler is listening', () => {
        const transport = createWebViewDappTransport()
        const { page, inject } = pageAt(ORIGIN)

        transport.receive(page, messageOf(), ORIGIN)

        expect(injectedOf(inject)).toContain('4900')
    })

    it('delivers an answer through the origin-guarded page function while the page is attached', async () => {
        const transport = createWebViewDappTransport()
        const { page, inject } = pageAt(ORIGIN)
        transport.attach(page)
        let respond: Parameters<
            Parameters<typeof transport.onRequest>[0]
        >[2] = async () => {}
        transport.onRequest((_ctx, _request, answer) => {
            respond = answer
        })
        transport.receive(page, messageOf(), ORIGIN)

        await respond({ jsonrpc: '2.0', id: 'r1', result: '0x1' })

        const script = injectedOf(inject)
        expect(script).toContain(`location.origin === "${ORIGIN}"`)
        expect(script).toContain(`window["${EIP1193_DELIVER_GLOBAL}"]`)
        expect(script).toContain('"result":"0x1"')
    })

    it('refuses to deliver once the page has navigated to another origin', async () => {
        const transport = createWebViewDappTransport()
        const { page, inject, state } = pageAt(ORIGIN)
        transport.attach(page)
        let respond: Parameters<
            Parameters<typeof transport.onRequest>[0]
        >[2] = async () => {}
        transport.onRequest((_ctx, _request, answer) => {
            respond = answer
        })
        transport.receive(page, messageOf(), ORIGIN)
        state.url = 'https://other.example/'

        await expect(
            respond({ jsonrpc: '2.0', id: 'r1', result: '0x1' }),
        ).rejects.toThrow()
        expect(inject).not.toHaveBeenCalled()
    })

    it('refuses to deliver after the page detaches', async () => {
        const transport = createWebViewDappTransport()
        const { page } = pageAt(ORIGIN)
        const detach = transport.attach(page)
        let respond: Parameters<
            Parameters<typeof transport.onRequest>[0]
        >[2] = async () => {}
        transport.onRequest((_ctx, _request, answer) => {
            respond = answer
        })
        transport.receive(page, messageOf(), ORIGIN)
        detach()

        await expect(
            respond({ jsonrpc: '2.0', id: 'r1', result: '0x1' }),
        ).rejects.toThrow()
    })

    it('notifies only attached pages on the same origin', async () => {
        const transport = createWebViewDappTransport()
        const same = pageAt(`${ORIGIN}/a`)
        const other = pageAt('https://other.example/')
        const detached = pageAt(`${ORIGIN}/b`)
        transport.attach(same.page)
        transport.attach(other.page)
        transport.attach(detached.page)()

        await transport.notify(ORIGIN, {
            jsonrpc: '2.0',
            method: 'chainChanged',
            params: '0x2105',
        })

        expect(injectedOf(same.inject)).toContain('chainChanged')
        expect(other.inject).not.toHaveBeenCalled()
        expect(detached.inject).not.toHaveBeenCalled()
    })
})

describe('isEip1193PageMessage', () => {
    it('accepts a well-formed provider message', () => {
        expect(isEip1193PageMessage(messageOf())).toBe(true)
    })

    it('rejects a Pera bridge JSON-RPC message', () => {
        expect(
            isEip1193PageMessage({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAddresses',
                token: 't',
            }),
        ).toBe(false)
    })

    it('rejects a message without a boolean gesture flag or a JSON-RPC request', () => {
        expect(
            isEip1193PageMessage({ ...messageOf(), hasUserActivation: 'yes' }),
        ).toBe(false)
        expect(isEip1193PageMessage({ ...messageOf(), request: {} })).toBe(
            false,
        )
    })
})
