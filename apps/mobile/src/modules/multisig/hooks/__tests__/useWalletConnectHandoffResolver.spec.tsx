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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '@perawallet/wallet-core-signing'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

// Replace the polling state machine with a spy: the hook spec only verifies
// the registry-subscription + lifecycle wiring, not polling behavior (which
// is covered by resolveWalletConnectHandoff.spec.ts). The fake `startPolling`
// records a timer in `ctx.timers` so the hook's per-handoff dedup guard and
// unmount cleanup are exercised realistically.
const { startPollingMock } = vi.hoisted(() => ({
    startPollingMock: vi.fn(),
}))

vi.mock('../resolveWalletConnectHandoff', () => ({
    startPolling: startPollingMock,
}))

import { useWalletConnectHandoffResolver } from '../useWalletConnectHandoffResolver'

const makeHandoff = (signRequestId: string): PendingWalletConnectHandoff => ({
    signRequestId,
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B', 'C'] },
    deviceId: 'device-1',
    network: 'testnet',
    callbacks: {},
    source: { type: 'walletconnect' },
    registeredAt: Date.now(),
})

describe('useWalletConnectHandoffResolver', () => {
    beforeEach(() => {
        walletConnectHandoffs.__resetForTests()
        startPollingMock.mockReset()
        // Mimic the real startPolling registering a timer so the hook's
        // `timersRef.has(...)` dedup guard behaves as in production.
        startPollingMock.mockImplementation((handoff, ctx) => {
            ctx.timers.set(
                handoff.signRequestId,
                setTimeout(() => {}, 1_000_000),
            )
        })
    })

    afterEach(() => {
        for (const handoff of walletConnectHandoffs.list()) {
            walletConnectHandoffs.unregister(handoff.signRequestId)
        }
    })

    it('starts polling for a handoff already registered at mount', () => {
        walletConnectHandoffs.register(makeHandoff('sr-1'))

        renderHook(() => useWalletConnectHandoffResolver())

        expect(startPollingMock).toHaveBeenCalledTimes(1)
        expect(startPollingMock.mock.calls[0]![0]).toMatchObject({
            signRequestId: 'sr-1',
        })
    })

    it('starts polling when a handoff is registered after mount', () => {
        renderHook(() => useWalletConnectHandoffResolver())
        expect(startPollingMock).not.toHaveBeenCalled()

        act(() => {
            walletConnectHandoffs.register(makeHandoff('sr-1'))
        })

        expect(startPollingMock).toHaveBeenCalledTimes(1)
        expect(startPollingMock.mock.calls[0]![0]).toMatchObject({
            signRequestId: 'sr-1',
        })
    })

    it('starts polling once per handoff, not again for already-tracked ones', () => {
        renderHook(() => useWalletConnectHandoffResolver())

        act(() => {
            walletConnectHandoffs.register(makeHandoff('sr-1'))
        })
        act(() => {
            walletConnectHandoffs.register(makeHandoff('sr-2'))
        })

        expect(startPollingMock).toHaveBeenCalledTimes(2)
        const polledIds = startPollingMock.mock.calls.map(
            call => call[0].signRequestId,
        )
        expect(polledIds).toEqual(['sr-1', 'sr-2'])
    })

    it('clears tracked timers on unmount', () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        walletConnectHandoffs.register(makeHandoff('sr-1'))
        const { unmount } = renderHook(() => useWalletConnectHandoffResolver())

        unmount()

        expect(clearTimeoutSpy).toHaveBeenCalled()
        clearTimeoutSpy.mockRestore()
    })

    it('does not start polling after unmount when a handoff registers', () => {
        const { unmount } = renderHook(() => useWalletConnectHandoffResolver())
        unmount()

        act(() => {
            walletConnectHandoffs.register(makeHandoff('sr-1'))
        })

        expect(startPollingMock).not.toHaveBeenCalled()
    })
})
