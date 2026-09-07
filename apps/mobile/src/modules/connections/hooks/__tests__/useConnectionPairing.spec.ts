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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
    ConnectionPairOptions,
    ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import { DEEPLINK_TIMEOUT_TAG } from '@hooks/deeplink/handlers/timeout'

const mockPair = vi.fn(
    async (_uri: string, _opts?: ConnectionPairOptions) => 'pairing-a',
)
const mockAbandonPairing = vi.fn()

type ErrorScope = { pairingId?: string }
const proposalListeners = new Set<(proposal: { pairingId?: string }) => void>()
const errorListeners = new Set<(error: Error, scope?: ErrorScope) => void>()

const fakeRegistry = {
    pair: mockPair,
    abandonPairing: (pairingId: string) => mockAbandonPairing(pairingId),
    // Stands in for the v1 handler's own parse: the hook must not know
    // what a `wc:` URI looks like.
    describeUri: (uri: string) => ({
        topic: /^wc:([^@?#]+)@/.exec(uri)?.[1] ?? null,
    }),
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
} as unknown as ConnectionRegistryClient

let registry: ConnectionRegistryClient | null = fakeRegistry

vi.mock('@perawallet/wallet-core-connections', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-connections')
    >()),
    useOptionalConnectionRegistry: () => registry,
}))

const { useConnectionPairing } = await import('../useConnectionPairing')
const {
    CONNECTION_LATE_PAIRING_GRACE_MS,
    CONNECTION_OUTCOME_TIMEOUT_MS,
    resetConnectionPairingStateForTesting,
} = await import('@perawallet/wallet-core-connections')

const emitProposal = (pairingId?: string): void => {
    for (const listener of [...proposalListeners]) listener({ pairingId })
}
const emitError = (error: Error, pairingId?: string): void => {
    for (const listener of [...errorListeners]) listener(error, { pairingId })
}

/** Lets the sequence get past `registry.pair` and arm its watch. */
const settlePairCall = async (): Promise<void> => {
    for (let tick = 0; tick < 8; tick += 1) await Promise.resolve()
}

describe('useConnectionPairing', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        registry = fakeRegistry
        mockPair.mockClear()
        mockPair.mockResolvedValue('pairing-a')
        mockAbandonPairing.mockClear()
        proposalListeners.clear()
        errorListeners.clear()
        resetConnectionPairingStateForTesting()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('runs the shared pairing sequence against the context registry', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b', {
            origin: { source: 'external-browser', browserName: 'Chrome' },
        })
        await settlePairCall()
        emitProposal('pairing-a')

        await expect(pairing).resolves.toEqual({ type: 'session' })
        expect(mockPair).toHaveBeenCalledWith('wc:topic@1?bridge=b', {
            origin: { source: 'external-browser', browserName: 'Chrome' },
        })
    })

    // Onboarding renders the deep-link hook above the provider.
    it('reports a connect failure rather than throwing when no provider is mounted', async () => {
        registry = null
        const { result } = renderHook(() => useConnectionPairing())

        await expect(
            result.current.pair('wc:topic@1?bridge=b'),
        ).resolves.toMatchObject({ type: 'connect-failed' })
        expect(mockPair).not.toHaveBeenCalled()
    })

    // The deeplink error sheet shows "took too long" copy off this tag, so a
    // hung bridge must surface as a deeplink timeout and not a generic error.
    it('reports a hung pair step as a deeplink timeout', async () => {
        mockPair.mockReturnValueOnce(new Promise(() => {}))
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b')
        await vi.advanceTimersByTimeAsync(10_000)

        const outcome = await pairing
        expect(outcome.type).toBe('connect-failed')
        if (outcome.type !== 'connect-failed') return
        expect(outcome.error).toMatchObject({ tag: DEEPLINK_TIMEOUT_TAG })
    })

    it('describes a URI through the claiming handler, never returning the URI itself', () => {
        const { result } = renderHook(() => useConnectionPairing())

        const described = result.current.describeUri(
            'wc:topic@1?bridge=b&key=beef',
        )

        expect(described).toEqual({ topic: 'topic' })
        expect(JSON.stringify(described)).not.toContain('beef')
    })

    describe('late outcome grace', () => {
        const timeOut = async (): Promise<void> => {
            await settlePairCall()
            await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)
        }

        it('keeps watching a timed-out pairing and leaves it alive when a proposal lands inside the grace', async () => {
            const { result } = renderHook(() => useConnectionPairing())

            const pairing = result.current.pair('wc:topic@1?bridge=b')
            await timeOut()
            const outcome = await pairing
            expect(outcome).toMatchObject({
                type: 'timeout',
                pairingId: 'pairing-a',
            })
            if (outcome.type !== 'timeout') return
            emitProposal('pairing-a')
            await vi.advanceTimersByTimeAsync(CONNECTION_LATE_PAIRING_GRACE_MS)

            await expect(outcome.lateOutcome).resolves.toEqual({
                type: 'proposal',
            })
            expect(mockAbandonPairing).not.toHaveBeenCalled()
        })

        // Past the grace the connector is still bound for the request TTL;
        // abandoning it here is what stops a ghost approval sheet minutes on.
        it('abandons a timed-out pairing once the default grace passes with no answer', async () => {
            const { result } = renderHook(() => useConnectionPairing())

            const pairing = result.current.pair('wc:topic@1?bridge=b')
            await timeOut()
            await pairing
            expect(mockAbandonPairing).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(CONNECTION_LATE_PAIRING_GRACE_MS)

            expect(mockAbandonPairing).toHaveBeenCalledWith('pairing-a')
        })
    })
})
