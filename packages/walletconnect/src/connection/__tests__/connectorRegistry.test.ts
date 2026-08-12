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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import WalletConnect from '@perawallet/walletconnect'
import { isRetryableError } from '@perawallet/wallet-core-shared'
import {
    __resetRegistryForTests,
    abandonPairing,
    ensureConnectorReady,
    forgetConnector,
    getConnector,
    reconnectAllConnectors,
    registerConnector,
    setConnectorHandlerBinder,
} from '../connectorRegistry'
import { useWalletConnectStore } from '../../store'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidSessionError,
} from '../../errors'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-shared')
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(actual as any),
        logger: { debug: vi.fn(), error: vi.fn() },
    }
})

vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 64,
}))

// A recreated connector starts with a closed socket; `_transport.connected`
// is the field the registry reads (and tests flip) to simulate it opening.
vi.mock('@perawallet/walletconnect', () => ({
    default: vi.fn(function (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opts: any,
    ) {
        return {
            clientId: opts?.session?.clientId ?? 'recreated-client',
            connected: true,
            session: opts?.session ?? { peerId: 'peer' },
            _transport: { connected: false },
            on: vi.fn(),
            off: vi.fn(),
            transportClose: vi.fn(),
            approveRequest: vi.fn(),
            rejectRequest: vi.fn(),
        }
    }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockConnector = any

const makeConnector = (clientId: string): MockConnector => ({
    clientId,
    connected: true,
    session: { peerId: `peer-${clientId}`, clientId },
    // `connected: false` = socket closed; tests flip it to simulate open.
    _transport: { connected: false },
    on: vi.fn(),
    off: vi.fn(),
    transportClose: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
})

describe('connectorRegistry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        __resetRegistryForTests()
        useWalletConnectStore.getState().resetState()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('abandonPairing', () => {
        it('tears down a pending pairing so a late session_request cannot fire its handlers', () => {
            const pending = makeConnector('c1')
            pending.connected = false
            registerConnector('c1', pending)

            abandonPairing('c1')

            expect(pending.off).toHaveBeenCalledWith('session_request')
            expect(pending.transportClose).toHaveBeenCalledTimes(1)
            expect(getConnector('c1')).toBeUndefined()
        })

        it('refuses to touch a connected session', () => {
            const connected = makeConnector('c1')
            connected.connected = true
            registerConnector('c1', connected)

            abandonPairing('c1')

            expect(connected.transportClose).not.toHaveBeenCalled()
            expect(getConnector('c1')).toBe(connected)
        })

        it('refuses to touch a session with a persisted connection', () => {
            const pending = makeConnector('c1')
            pending.connected = false
            registerConnector('c1', pending)
            useWalletConnectStore
                .getState()
                .setWalletConnectConnections([{ clientId: 'c1' }])

            abandonPairing('c1')

            expect(pending.transportClose).not.toHaveBeenCalled()
            expect(getConnector('c1')).toBe(pending)
        })

        it('is a no-op for an unknown clientId', () => {
            expect(() => abandonPairing('unknown')).not.toThrow()
        })
    })

    describe('ensureConnectorReady', () => {
        it('returns the existing connector without recreating when the socket is open', async () => {
            const conn = makeConnector('c1')
            conn._transport.connected = true
            registerConnector('c1', conn)

            const result = await ensureConnectorReady('c1')

            expect(result).toBe(conn)
            expect(WalletConnect).not.toHaveBeenCalled()
        })

        it('rejects with WalletConnectInvalidSessionError for an unknown session', async () => {
            await expect(
                ensureConnectorReady('unknown'),
            ).rejects.toBeInstanceOf(WalletConnectInvalidSessionError)
        })

        it('recreates a fresh connector when the socket is not open', async () => {
            const binder = vi.fn()
            setConnectorHandlerBinder(binder)
            const stale = makeConnector('c1')
            registerConnector('c1', stale)

            const promise = ensureConnectorReady('c1', 1000)

            // recreateConnector runs synchronously up to the first await:
            // a fresh connector is built, the stale one is torn down, and
            // the handler binder re-attaches the dApp request handlers.
            expect(WalletConnect).toHaveBeenCalledTimes(1)
            expect(stale.transportClose).toHaveBeenCalled()
            const fresh = vi.mocked(WalletConnect).mock.results[0]
                .value as MockConnector
            expect(binder).toHaveBeenCalledWith(fresh)
            expect(getConnector('c1')).toBe(fresh)

            // Simulate the fresh socket opening.
            fresh._transport.connected = true
            await vi.advanceTimersByTimeAsync(100)

            await expect(promise).resolves.toBe(fresh)
        })

        it('rejects with a retryable WalletConnectConnectionTimeoutError when the socket never opens', async () => {
            registerConnector('c1', makeConnector('c1'))

            const promise = ensureConnectorReady('c1', 1000)
            const settled = promise.catch((error: unknown) => error)

            await vi.advanceTimersByTimeAsync(1100)

            const error = await settled
            expect(error).toBeInstanceOf(WalletConnectConnectionTimeoutError)
            expect(isRetryableError(error as Error)).toBe(true)
        })

        it('shares a single recreation between concurrent callers', async () => {
            registerConnector('c1', makeConnector('c1'))

            const first = ensureConnectorReady('c1', 1000)
            const second = ensureConnectorReady('c1', 1000)
            // Attach handlers before advancing timers so the shared
            // timeout rejection is never seen as unhandled.
            const settled = Promise.allSettled([first, second])

            expect(first).toBe(second)
            expect(WalletConnect).toHaveBeenCalledTimes(1)

            await vi.advanceTimersByTimeAsync(1100)
            await settled
        })

        it('clears the in-flight guard after a timeout so a later call retries', async () => {
            registerConnector('c1', makeConnector('c1'))

            const firstSettled = ensureConnectorReady('c1', 1000).catch(
                () => undefined,
            )
            await vi.advanceTimersByTimeAsync(1100)
            await firstSettled

            // A second call recreates again rather than returning the
            // stale rejected promise.
            const retry = ensureConnectorReady('c1', 1000)
            const retrySettled = retry.catch(() => undefined)
            expect(WalletConnect).toHaveBeenCalledTimes(2)
            await vi.advanceTimersByTimeAsync(1100)
            await retrySettled
        })

        it('aborts the recreation when the session is forgotten mid-reconnect', async () => {
            registerConnector('c1', makeConnector('c1'))

            const promise = ensureConnectorReady('c1', 1000)
            const settled = promise.catch((error: unknown) => error)
            const fresh = vi.mocked(WalletConnect).mock.results[0]
                .value as MockConnector

            // User disconnects the session while the socket is opening.
            forgetConnector('c1')
            fresh._transport.connected = true
            await vi.advanceTimersByTimeAsync(100)

            expect(await settled).toBeInstanceOf(
                WalletConnectInvalidSessionError,
            )
        })
    })

    describe('reconnectAllConnectors', () => {
        it('recreates only the sessions whose socket is not open', async () => {
            const open = makeConnector('open')
            open._transport.connected = true
            registerConnector('open', open)

            registerConnector('closed', makeConnector('closed'))

            reconnectAllConnectors(1000)

            // Only the closed session is recreated.
            expect(WalletConnect).toHaveBeenCalledTimes(1)

            await vi.advanceTimersByTimeAsync(1100)
        })
    })

    describe('forgetConnector', () => {
        it('removes the connector from the registry', () => {
            registerConnector('c1', makeConnector('c1'))
            expect(getConnector('c1')).toBeDefined()

            forgetConnector('c1')

            expect(getConnector('c1')).toBeUndefined()
        })
    })
})
