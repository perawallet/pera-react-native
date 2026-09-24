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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    CONNECTION_LATE_PAIRING_GRACE_MS,
    resetConnectionPairingStateForTesting,
} from '@perawallet/wallet-core-connections'
import { logger } from '@perawallet/wallet-core-shared'
import { useNetworkStatusStore } from '@modules/network'
import { useWalletConnectHandler } from '../useWalletConnectHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

vi.mock('@perawallet/wallet-core-shared', async () => ({
    // The pairing sequence's timeout and promise guards, real: both modules
    // are side-effect free and a stand-in would prove nothing about timing.
    ...(await vi.importActual<
        typeof import('../../../../../../../../packages/shared/src/utils/async')
    >('../../../../../../../../packages/shared/src/utils/async')),
    toError: (error: unknown) =>
        error instanceof Error ? error : new Error(String(error)),
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    AppError: class AppError extends Error {},
    // The `@modules/network` barrel transitively pulls store modules that
    // self-register for reset-on-logout.
    registerStore: vi.fn(),
}))

// The real `useConnectionPairing` runs here — only the registry underneath it
// is faked, so the topic de-dupe, the origin recording and the pairing-scoped
// outcome wait are all exercised rather than stubbed.
const mockConnect = vi.fn(() => Promise.resolve('pairing-client'))
const mockAbandonPairing = vi.fn()

// The v1 handler's own `describeUri`, mirrored from
// packages/walletconnect/src/shared/uri.ts: the real barrel pulls in the
// store/hook modules this file's other mocks exist to stub out.
const describeWalletConnectUri = (
    uri: string,
): { topic: string | null; bridgeOrigin: string | null } => {
    const topic = /^wc:([^@?#]+)@/.exec(uri)?.[1] ?? null
    const bridgeValue = /[?&]bridge=([^&#]+)/.exec(uri)?.[1]
    let bridgeOrigin: string | null = null
    if (bridgeValue) {
        try {
            const origin = new URL(decodeURIComponent(bridgeValue)).origin
            bridgeOrigin = origin === 'null' ? null : origin
        } catch {
            // A malformed bridge value only costs this diagnostic field.
        }
    }
    return { topic, bridgeOrigin }
}

type ErrorScope = { pairingId?: string }
const proposalListeners = new Set<(proposal: { pairingId?: string }) => void>()
const errorListeners = new Set<(error: Error, scope?: ErrorScope) => void>()

/** Answers the pairing the way a handler would, once `pair` has resolved. */
const answerPairing = (
    outcome: { type: 'proposal' } | { type: 'error'; error: Error },
    pairingId = 'pairing-client',
): void => {
    if (outcome.type === 'proposal') {
        for (const listener of proposalListeners) listener({ pairingId })
        return
    }
    for (const listener of errorListeners) {
        listener(outcome.error, { pairingId })
    }
}

vi.mock('@perawallet/wallet-core-connections', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-connections')
    >()),
    useOptionalConnectionRegistry: () => ({
        pair: mockConnect,
        abandonPairing: mockAbandonPairing,
        describeUri: describeWalletConnectUri,
        subscribeToProposals: (
            listener: (proposal: { pairingId?: string }) => void,
        ) => {
            proposalListeners.add(listener)
            return () => proposalListeners.delete(listener)
        },
        subscribeToErrors: (
            listener: (error: Error, scope?: ErrorScope) => void,
        ) => {
            errorListeners.add(listener)
            return () => errorListeners.delete(listener)
        },
    }),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => {
    class MockBridgeConnectionError extends Error {}
    return {
        WalletConnectBridgeConnectionError: MockBridgeConnectionError,
        // Real value from packages/walletconnect/src/shared/constants.ts.
        WC_DELIVERY_TIMEOUT_MS: 8000,
        parseWalletConnectUri: vi.fn((uri: string) =>
            uri.startsWith('wc:') || uri.startsWith('perawallet-wc:')
                ? { uri: uri.replace('perawallet-wc:', 'wc:') }
                : null,
        ),
    }
})

const WC_URI = 'wc:topic@2?relay-protocol=irn'

describe('useWalletConnectHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        proposalListeners.clear()
        errorListeners.clear()
        // The handshake-topic join in useConnectionPairing is module-level;
        // clear it so one test's pending pairing can't swallow another's.
        resetConnectionPairingStateForTesting()
    })

    const render = (sourceUrl: string | null = null) => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            useWalletConnectHandler(webview, sourceUrl),
        )
        return {
            webview,
            connect: (id: string, uri = WC_URI) =>
                result.current(
                    bridgeMessage(id, 'walletConnect', { uri }),
                    TRUSTED,
                ),
        }
    }

    it('rejects non-WalletConnect URIs with InvalidParams', () => {
        const { webview, connect } = render()

        act(() => connect('wc-invalid', 'https://evil.com'))

        expect(mockConnect).not.toHaveBeenCalled()
        const sent = injectedScript(webview)
        expect(sent).toContain('"code":-32602')
        expect(sent).toContain('"Invalid WalletConnect URI"')
    })

    it('answers InvalidParams when the uri is missing', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            useWalletConnectHandler(webview, null),
        )

        result.current(bridgeMessage('wc-missing', 'walletConnect'), TRUSTED)

        expect(mockConnect).not.toHaveBeenCalled()
        expect(injectedScript(webview)).toContain('"code":-32602')
    })

    it('opens the approval flow as an in-app pairing, never auto-connecting', async () => {
        const { connect } = render(
            'https://discover-mobile-staging.perawallet.app/',
        )

        act(() => connect('wc-trusted'))

        // The origin travels with `pair`; the handler writes it onto the
        // approved connection so post-action sheets stay suppressed.
        await waitFor(() => {
            expect(mockConnect).toHaveBeenCalledWith(
                WC_URI,
                expect.objectContaining({
                    origin: expect.objectContaining({ source: 'in-app' }),
                }),
            )
        })
    })

    it('answers the page with a readable error when the pairing outcome times out', async () => {
        vi.useFakeTimers()
        try {
            const { webview, connect } = render()

            await act(async () => {
                connect('wc-timeout')
                // Nothing ever answers: run out the outcome budget.
                await vi.advanceTimersByTimeAsync(9000)
            })

            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"wc-timeout"')
            expect(sent).toContain('No response from the dApp')
        } finally {
            vi.useRealTimers()
        }
    })

    // Without this an in-app pairing stayed bound forever, and a reviving
    // bridge popped an approval sheet over an unrelated page.
    it('abandons a timed-out pairing once its late grace passes', async () => {
        vi.useFakeTimers()
        try {
            const { connect } = render()

            await act(async () => {
                connect('wc-late')
                await vi.advanceTimersByTimeAsync(9000)
            })
            expect(mockAbandonPairing).not.toHaveBeenCalled()

            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    CONNECTION_LATE_PAIRING_GRACE_MS,
                )
            })

            expect(mockAbandonPairing).toHaveBeenCalledWith('pairing-client')
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps a timed-out pairing alive when the peer answers inside the grace', async () => {
        vi.useFakeTimers()
        try {
            const { connect } = render()

            await act(async () => {
                connect('wc-late-answer')
                await vi.advanceTimersByTimeAsync(9000)
                answerPairing({ type: 'proposal' })
                await vi.advanceTimersByTimeAsync(
                    CONNECTION_LATE_PAIRING_GRACE_MS,
                )
            })

            expect(mockAbandonPairing).not.toHaveBeenCalled()
        } finally {
            vi.useRealTimers()
        }
    })

    it('relays a pairing rejection (e.g. wrong network) back to the page', async () => {
        const { webview, connect } = render()

        await act(async () => {
            connect('wc-rejected')
            await Promise.resolve()
            await Promise.resolve()
            answerPairing({ type: 'error', error: new Error('wrong network') })
            await Promise.resolve()
            await Promise.resolve()
        })

        const sent = injectedScript(webview)
        expect(sent).toContain('"id":"wc-rejected"')
        expect(sent).toContain('wrong network')
    })

    it('logs a connect failure by topic and bridge origin, never the URI', async () => {
        mockConnect.mockRejectedValueOnce(new Error('bridge unreachable'))
        const { webview, connect } = render()

        await act(async () => {
            connect(
                'wc-fail',
                'wc:topic-1@1?bridge=https%3A%2F%2Fb.example&key=deadbeef',
            )
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(logger.error).toHaveBeenCalledWith(
            '[webview/wc] connect failed',
            {
                error: expect.any(Error),
                topic: 'topic-1',
                bridgeOrigin: 'https://b.example',
            },
        )
        const context = vi.mocked(logger.error).mock.calls.at(-1)?.[1]
        expect(JSON.stringify(context)).not.toContain('deadbeef')
        expect(injectedScript(webview)).toContain(
            'Could not start the WalletConnect session',
        )
    })

    it('short-circuits with an offline error instead of dialing a dead bridge', () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        try {
            const { webview, connect } = render()

            act(() => connect('wc-offline'))

            expect(mockConnect).not.toHaveBeenCalled()
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"wc-offline"')
            expect(sent).toContain('offline')
        } finally {
            useNetworkStatusStore.setState({ hasInternet: true })
        }
    })

    it('throttles a second connect from the same origin inside the window', () => {
        vi.useFakeTimers()
        try {
            const { webview, connect } = render('https://evil.com/')

            act(() => connect('wc-first'))
            expect(mockConnect).toHaveBeenCalledTimes(1)

            act(() => connect('wc-spam', 'wc:other@2?relay-protocol=irn'))

            expect(mockConnect).toHaveBeenCalledTimes(1)
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"wc-spam"')
            expect(sent).toContain('"code":-32600')
            expect(sent).toContain('throttled')
        } finally {
            vi.useRealTimers()
        }
    })

    it('accepts a connect again once the window elapsed and the first pairing settled', async () => {
        vi.useFakeTimers()
        try {
            const { connect } = render()

            act(() => connect('wc-first'))
            expect(mockConnect).toHaveBeenCalledTimes(1)

            // Settle the first pairing: while it is in flight, a retry on the
            // same handshake topic deliberately joins it (one connector per
            // topic) instead of building a second one.
            await act(async () => {
                await vi.runAllTimersAsync()
            })
            vi.advanceTimersByTime(2000)

            act(() => connect('wc-retry'))
            expect(mockConnect).toHaveBeenCalledTimes(2)
        } finally {
            vi.useRealTimers()
        }
    })

    it('joins a retry onto the in-flight pairing for the same handshake topic', () => {
        vi.useFakeTimers()
        try {
            const { connect } = render()

            act(() => connect('wc-first'))
            vi.advanceTimersByTime(2000)
            act(() => connect('wc-retry'))

            // One connector per topic — a second one would receive the
            // bridge-replayed session_request again and queue a duplicate
            // approval sheet.
            expect(mockConnect).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })
})
