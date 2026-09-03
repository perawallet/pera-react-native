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
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { AppState, type AppStateStatus } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import WalletConnect from '@perawallet/walletconnect'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { startReconnectSweep } from '../reconnectSweep'
import {
    __resetRegistryForTests,
    getConnector,
    registerConnector,
} from '../../connection/connectorRegistry'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

// A recreated connector starts with a closed socket; `_transport.connected`
// is the field the registry reads (and tests flip) to simulate it opening —
// same stand-in as connection/__tests__/connectorRegistry.test.ts.
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

vi.mock('react-native', () => ({
    AppState: {
        currentState: 'active',
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Platform: { OS: 'android' },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockConnector = any

const makeConnector = (
    clientId: string,
    peerId: Nullable<string>,
): MockConnector => ({
    clientId,
    connected: true,
    session: { peerId, clientId },
    // `connected: false` = socket closed; tests flip it to simulate open.
    _transport: { connected: false },
    on: vi.fn(),
    off: vi.fn(),
    transportClose: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
})

describe('startReconnectSweep', () => {
    let appStateChangeHandler: Nullable<(next: AppStateStatus) => void> = null
    const removeListener = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        __resetRegistryForTests()
        appStateChangeHandler = null
        ;(AppState.addEventListener as Mock).mockImplementation(
            (_event, handler: (next: AppStateStatus) => void) => {
                appStateChangeHandler = handler
                return { remove: removeListener }
            },
        )
        onlineManager.setOnline(true)
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        vi.useRealTimers()
    })

    it('revives a disconnected connector on a background→foreground transition', async () => {
        registerConnector('c1', makeConnector('c1', 'peer-1'))
        const teardown = startReconnectSweep()

        appStateChangeHandler?.('background')
        appStateChangeHandler?.('active')

        expect(WalletConnect).toHaveBeenCalledTimes(1)
        const fresh = vi.mocked(WalletConnect).mock.results[0]
            .value as MockConnector
        fresh._transport.connected = true
        await vi.advanceTimersByTimeAsync(100)

        expect(getConnector('c1')).toBe(fresh)
        teardown()
    })

    it('leaves an already-connected socket alone', () => {
        const healthy = makeConnector('c1', 'peer-1')
        healthy._transport.connected = true
        registerConnector('c1', healthy)
        const teardown = startReconnectSweep()

        appStateChangeHandler?.('background')
        appStateChangeHandler?.('active')

        expect(WalletConnect).not.toHaveBeenCalled()
        expect(getConnector('c1')).toBe(healthy)
        teardown()
    })

    it('does not throw when a revival fails', async () => {
        // No peerId: recreateConnector has nothing to deliver to and
        // rejects immediately — the sweep must swallow that, not surface it.
        registerConnector('c1', makeConnector('c1', null))
        const teardown = startReconnectSweep()

        expect(() => {
            appStateChangeHandler?.('background')
            appStateChangeHandler?.('active')
        }).not.toThrow()
        await vi.advanceTimersByTimeAsync(100)

        expect(WalletConnect).not.toHaveBeenCalled()
        teardown()
    })

    it('also revives on a debounced offline→online edge', async () => {
        registerConnector('c1', makeConnector('c1', 'peer-1'))
        const teardown = startReconnectSweep()

        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
        await vi.advanceTimersByTimeAsync(1100)

        expect(WalletConnect).toHaveBeenCalledTimes(1)
        teardown()
    })

    it('tears down both subscriptions and cancels a pending debounce on teardown', () => {
        registerConnector('c1', makeConnector('c1', 'peer-1'))
        const teardown = startReconnectSweep()

        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
        teardown()
        vi.advanceTimersByTime(2000)

        expect(removeListener).toHaveBeenCalledTimes(1)
        expect(WalletConnect).not.toHaveBeenCalled()
    })
})
