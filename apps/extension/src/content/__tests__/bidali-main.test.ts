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
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'

declare global {
    interface Window {
        bidaliProvider?: {
            key: string
            name: string
            paymentCurrencies: string[]
            balances: Record<string, string>
            onPaymentRequest: (req: unknown) => void
            openUrl: (urlOrObj: unknown) => void
            paymentSent?: () => void
            paymentCancelled?: () => void
        }
    }
}

const TOKEN = 'bidali-test-token-1'

const loadScript = async (): Promise<void> => {
    vi.resetModules()
    await import('../bidali-main')
}

const captureHandshake = (): { handshake?: DiscoverChannelHandshake } => {
    const captured: { handshake?: DiscoverChannelHandshake } = {}
    window.addEventListener('__pera_discover_handshake__', event => {
        captured.handshake = (
            event as CustomEvent<DiscoverChannelHandshake>
        ).detail
    })
    return captured
}

const setUrl = (params: Record<string, string> = {}): void => {
    const search = new URLSearchParams({
        peraBridgeToken: TOKEN,
        ...params,
    }).toString()
    window.history.replaceState(null, '', `/?${search}`)
}

const listenForRequests = (
    captured: ReturnType<typeof captureHandshake>,
): unknown[] => {
    const received: unknown[] = []
    window.addEventListener(captured.handshake!.requestEventName, event =>
        received.push((event as CustomEvent).detail),
    )
    return received
}

// bidali-main.ts registers a `window.addEventListener('message', …)`
// listener on load, and jsdom keeps one shared `window` across every test in
// this file — vi.resetModules() clears the module cache but does nothing to
// listeners already attached to that window. Left untracked, each
// loadScript() call would leave the previous test's listener live, so a
// later message fires every accumulated listener at once. Spy on
// addEventListener to capture each test's own 'message' listener and detach
// it afterward, restoring one-listener-per-test isolation.
let messageListeners: EventListenerOrEventListenerObject[]

beforeEach(() => {
    delete window.bidaliProvider
    setUrl()
    messageListeners = []
    const realAddEventListener = window.addEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation(
        (type, listener, options) => {
            if (type === 'message') {
                messageListeners.push(
                    listener as EventListenerOrEventListenerObject,
                )
            }
            realAddEventListener(type, listener, options)
        },
    )
})

afterEach(() => {
    vi.restoreAllMocks()
    messageListeners.forEach(listener =>
        window.removeEventListener('message', listener),
    )
})

describe('bidali-main content script', () => {
    it('is inert without the bridge token param', async () => {
        window.history.replaceState(null, '', '/?key=abc')
        await loadScript()
        expect(window.bidaliProvider).toBeUndefined()
    })

    it('installs window.bidaliProvider with key from the URL and native-parity fields', async () => {
        setUrl({ key: 'my-api-key' })
        await loadScript()
        expect(window.bidaliProvider).toBeDefined()
        expect(window.bidaliProvider?.key).toBe('my-api-key')
        expect(window.bidaliProvider?.name).toBe('perawallet')
        expect(window.bidaliProvider?.paymentCurrencies).toEqual([
            'algorand',
            'usdcalgorand',
        ])
        expect(typeof window.bidaliProvider?.onPaymentRequest).toBe('function')
        expect(typeof window.bidaliProvider?.openUrl).toBe('function')
    })

    it('parses balances from peraBidaliBalances', async () => {
        const balances = { algorand: '12.5', usdcalgorand: '3' }
        setUrl({ peraBidaliBalances: JSON.stringify(balances) })
        await loadScript()
        expect(window.bidaliProvider?.balances).toEqual(balances)
    })

    it('falls back to {} balances when peraBidaliBalances is malformed', async () => {
        setUrl({ peraBidaliBalances: '{not-json' })
        await loadScript()
        expect(window.bidaliProvider?.balances).toEqual({})
    })

    it('falls back to {} balances when peraBidaliBalances is absent', async () => {
        await loadScript()
        expect(window.bidaliProvider?.balances).toEqual({})
    })

    it('onPaymentRequest posts the native envelope, falling back protocol to currencyProtocol', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received = listenForRequests(captured)

        window.bidaliProvider!.onPaymentRequest({
            address: 'ADDR',
            amount: '1.5',
            currencyProtocol: 'algorand',
            extraId: 'extra',
            chargeId: 'charge-1',
            description: 'desc',
        })

        expect(received).toHaveLength(1)
        const message = received[0] as {
            jsonrpc: string
            method: string
            id: string
            params: Record<string, unknown>
        }
        expect(message.jsonrpc).toBe('2.0')
        expect(message.method).toBe('bidaliPaymentRequest')
        expect(message.id).toMatch(/^bidali-\d+-[a-z0-9]+$/)
        expect(message.params).toEqual({
            address: 'ADDR',
            amount: '1.5',
            protocol: 'algorand',
            extraId: 'extra',
            chargeId: 'charge-1',
            description: 'desc',
        })
    })

    it('onPaymentRequest prefers protocol over currencyProtocol when both are present', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received = listenForRequests(captured)

        window.bidaliProvider!.onPaymentRequest({
            address: 'ADDR',
            amount: '1',
            protocol: 'usdcalgorand',
            currencyProtocol: 'algorand',
        })

        const message = received[0] as { params: Record<string, unknown> }
        expect(message.params.protocol).toBe('usdcalgorand')
    })

    it('ignores non-object payment requests', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received = listenForRequests(captured)

        window.bidaliProvider!.onPaymentRequest('not-an-object')
        window.bidaliProvider!.onPaymentRequest(null)
        window.bidaliProvider!.onPaymentRequest(undefined)

        expect(received).toHaveLength(0)
    })

    it('openUrl posts {url} for a plain string', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received = listenForRequests(captured)

        window.bidaliProvider!.openUrl('https://dapp.example/checkout')

        expect(received).toHaveLength(1)
        const message = received[0] as {
            method: string
            params: Record<string, unknown>
        }
        expect(message.method).toBe('openUrl')
        expect(message.params).toEqual({ url: 'https://dapp.example/checkout' })
    })

    it('openUrl posts {url} for the object form', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received = listenForRequests(captured)

        window.bidaliProvider!.openUrl({ url: 'https://dapp.example/other' })

        expect(received).toHaveLength(1)
        const message = received[0] as { params: Record<string, unknown> }
        expect(message.params).toEqual({ url: 'https://dapp.example/other' })
    })

    it('openUrl ignores payloads with no string url', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received = listenForRequests(captured)

        window.bidaliProvider!.openUrl({ url: 42 })
        window.bidaliProvider!.openUrl(42)

        expect(received).toHaveLength(0)
    })

    describe('host -> page bidaliEvent relay', () => {
        // jsdom's window.postMessage always delivers MessageEvent.source as
        // null, which would never exercise the production `event.source !==
        // window` guard (see inject-main.test.ts for the same workaround) —
        // dispatch a MessageEvent with an explicit `source: window` instead.
        const dispatchHostMessage = (data: unknown): void => {
            window.dispatchEvent(
                new MessageEvent('message', { data, source: window }),
            )
        }

        it('invokes paymentSent for a relayed paymentSent event', async () => {
            await loadScript()
            const paymentSent = vi.fn()
            const paymentCancelled = vi.fn()
            window.bidaliProvider!.paymentSent = paymentSent
            window.bidaliProvider!.paymentCancelled = paymentCancelled

            dispatchHostMessage({
                jsonrpc: '2.0',
                method: 'bidaliEvent',
                params: { event: 'paymentSent' },
            })

            expect(paymentSent).toHaveBeenCalledTimes(1)
            expect(paymentCancelled).not.toHaveBeenCalled()
        })

        it('invokes paymentCancelled for a relayed paymentCancelled event', async () => {
            await loadScript()
            const paymentSent = vi.fn()
            const paymentCancelled = vi.fn()
            window.bidaliProvider!.paymentSent = paymentSent
            window.bidaliProvider!.paymentCancelled = paymentCancelled

            dispatchHostMessage({
                jsonrpc: '2.0',
                method: 'bidaliEvent',
                params: { event: 'paymentCancelled' },
            })

            expect(paymentCancelled).toHaveBeenCalledTimes(1)
            expect(paymentSent).not.toHaveBeenCalled()
        })

        it('does not throw when no paymentSent/paymentCancelled callback is assigned', async () => {
            await loadScript()
            expect(() =>
                dispatchHostMessage({
                    jsonrpc: '2.0',
                    method: 'bidaliEvent',
                    params: { event: 'paymentSent' },
                }),
            ).not.toThrow()
        })

        it('ignores unknown bidaliEvent values', async () => {
            await loadScript()
            const paymentSent = vi.fn()
            const paymentCancelled = vi.fn()
            window.bidaliProvider!.paymentSent = paymentSent
            window.bidaliProvider!.paymentCancelled = paymentCancelled

            dispatchHostMessage({
                jsonrpc: '2.0',
                method: 'bidaliEvent',
                params: { event: 'somethingElse' },
            })

            expect(paymentSent).not.toHaveBeenCalled()
            expect(paymentCancelled).not.toHaveBeenCalled()
        })

        it('ignores unrelated methods', async () => {
            await loadScript()
            const paymentSent = vi.fn()
            window.bidaliProvider!.paymentSent = paymentSent

            dispatchHostMessage({
                jsonrpc: '2.0',
                method: 'someOtherMethod',
                params: {},
            })

            expect(paymentSent).not.toHaveBeenCalled()
        })

        it('ignores messages not sourced from window', async () => {
            await loadScript()
            const paymentSent = vi.fn()
            window.bidaliProvider!.paymentSent = paymentSent

            window.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        jsonrpc: '2.0',
                        method: 'bidaliEvent',
                        params: { event: 'paymentSent' },
                    },
                    source: null,
                }),
            )

            expect(paymentSent).not.toHaveBeenCalled()
        })
    })
})
