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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Spy on the real export (not a wholesale vi.mock factory that could hide a
// regression) — see useWalletConnectProvider.web.test.ts's doc comment for
// why this matters: a twin that calls `useWalletConnect` anywhere would
// register a second connector handler binder from this UI surface.
const useWalletConnectSpy = vi.fn()
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: (...args: unknown[]) => useWalletConnectSpy(...args),
    // Real value from packages/walletconnect/src/constants.ts — the twin
    // imports this constant (not `useWalletConnect`) from the same package,
    // so the wholesale mock above must still supply it.
    WC_SESSION_OUTCOME_TIMEOUT_MS: 8000,
}))

type PairOutcomeMessage = {
    correlationId: string
    outcome:
        | { type: 'session' }
        | { type: 'error'; reason: string }
        | { type: 'timeout' }
}

const mockSendWcControlMessage = vi.fn()
const pairOutcomeUnsubscribe = vi.fn()
let pairOutcomeHandler: ((message: PairOutcomeMessage) => void) | undefined
const mockOnPairOutcome = vi.fn(
    (handler: (message: PairOutcomeMessage) => void) => {
        pairOutcomeHandler = handler
        return pairOutcomeUnsubscribe
    },
)

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    sendWcControlMessage: (...args: unknown[]) =>
        mockSendWcControlMessage(...args),
    onPairOutcome: (handler: (message: PairOutcomeMessage) => void) =>
        mockOnPairOutcome(handler),
}))

const sentCorrelationId = (): string => {
    const call = mockSendWcControlMessage.mock.calls[0]?.[0] as
        | { correlationId?: string }
        | undefined
    if (!call?.correlationId) throw new Error('no correlationId was sent')
    return call.correlationId
}

describe('useWalletConnectPairing (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        pairOutcomeHandler = undefined
        mockSendWcControlMessage.mockResolvedValue(undefined)
    })

    it('sends a pair control message carrying a correlationId instead of calling useWalletConnect', async () => {
        const { useWalletConnectPairing } =
            await import('../useWalletConnectPairing.web')
        const { result } = renderHook(() => useWalletConnectPairing())

        const pairPromise = result.current.pair('wc:123')
        const correlationId = sentCorrelationId()
        pairOutcomeHandler?.({ correlationId, outcome: { type: 'session' } })
        const outcome = await pairPromise

        expect(mockSendWcControlMessage).toHaveBeenCalledWith({
            kind: 'pair',
            uri: 'wc:123',
            correlationId,
        })
        expect(useWalletConnectSpy).not.toHaveBeenCalled()
        expect(outcome).toEqual({ type: 'session' })
    })

    it('reports connect-failed when the control message send itself fails', async () => {
        const sendError = new Error('no offscreen document')
        mockSendWcControlMessage.mockRejectedValue(sendError)
        const { useWalletConnectPairing } =
            await import('../useWalletConnectPairing.web')
        const { result } = renderHook(() => useWalletConnectPairing())

        const outcome = await result.current.pair('wc:123')

        expect(outcome).toEqual({ type: 'connect-failed', error: sendError })
        // The waiter registered before the send failed must be torn down —
        // otherwise its listener/timer would leak past this call.
        expect(pairOutcomeUnsubscribe).toHaveBeenCalledTimes(1)
    })

    it('resolves to an error outcome when the matching pair-outcome reports one (e.g. a network mismatch)', async () => {
        const { useWalletConnectPairing } =
            await import('../useWalletConnectPairing.web')
        const { result } = renderHook(() => useWalletConnectPairing())

        const pairPromise = result.current.pair('wc:123')
        const correlationId = sentCorrelationId()
        pairOutcomeHandler?.({
            correlationId,
            outcome: { type: 'error', reason: 'network-mismatch' },
        })
        const outcome = await pairPromise

        expect(outcome).toEqual({
            type: 'error',
            error: new Error('network-mismatch'),
        })
    })

    it('ignores a pair-outcome for a different correlationId — the wait still resolves as a timeout, not the mismatched outcome', async () => {
        vi.useFakeTimers()
        try {
            const { useWalletConnectPairing } =
                await import('../useWalletConnectPairing.web')
            const { result } = renderHook(() => useWalletConnectPairing())

            const pairPromise = result.current.pair('wc:123')
            pairOutcomeHandler?.({
                correlationId: 'some-other-correlation-id',
                outcome: { type: 'session' },
            })

            await vi.advanceTimersByTimeAsync(8000)

            // If the mismatched message had incorrectly settled this
            // promise, it would already be `{ type: 'session' }` here
            // regardless of the timer advance above.
            expect(await pairPromise).toEqual({ type: 'timeout' })
        } finally {
            vi.useRealTimers()
        }
    })

    it('times out after 8s when no matching pair-outcome ever arrives (e.g. a dead bridge with no session_request)', async () => {
        vi.useFakeTimers()
        try {
            const { useWalletConnectPairing } =
                await import('../useWalletConnectPairing.web')
            const { result } = renderHook(() => useWalletConnectPairing())

            const pairPromise = result.current.pair('wc:123')
            await vi.advanceTimersByTimeAsync(8000)

            expect(await pairPromise).toEqual({ type: 'timeout' })
            expect(pairOutcomeUnsubscribe).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })
})
