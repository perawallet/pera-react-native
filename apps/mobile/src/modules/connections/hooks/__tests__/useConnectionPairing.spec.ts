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
import type { ConnectionPairOptions } from '@perawallet/wallet-core-connections'

const mockPair = vi.fn(
    async (_uri: string, _opts?: ConnectionPairOptions) => 'pairing-a',
)
const mockAbandonPairing = vi.fn()

type ErrorScope = { pairingId?: string }
const proposalListeners = new Set<(proposal: { pairingId?: string }) => void>()
const errorListeners = new Set<(error: Error, scope?: ErrorScope) => void>()

vi.mock('../../providers/connectionRegistryContext', () => ({
    useOptionalConnectionRegistry: () => ({
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
    }),
}))

const { useConnectionPairing, resetConnectionPairingStateForTesting } =
    await import('../useConnectionPairing')

const emitProposal = (pairingId?: string): void => {
    for (const listener of [...proposalListeners]) listener({ pairingId })
}
const emitError = (error: Error, pairingId?: string): void => {
    for (const listener of [...errorListeners]) listener(error, { pairingId })
}

/** Lets the hook get past `registry.pair` and arm its watch. */
const settlePairCall = async (): Promise<void> => {
    // `withTimeout` wraps the registry call in a `Promise.race(...).finally`,
    // so the pairing id lands several microtasks after `pair` is invoked.
    for (let tick = 0; tick < 8; tick += 1) await Promise.resolve()
}

describe('useConnectionPairing', () => {
    beforeEach(() => {
        vi.useFakeTimers()
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

    it('hands the URI to the registry rather than deciding the protocol itself', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair(
            'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef',
        )
        await settlePairCall()
        emitProposal('pairing-a')

        await expect(pairing).resolves.toEqual({ type: 'session' })
        expect(mockPair).toHaveBeenCalledWith(
            'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef',
            { origin: undefined },
        )
    })

    it('reports a registry that refuses the URI as a connect failure', async () => {
        mockPair.mockRejectedValueOnce(new Error('No handler accepts this URI'))
        const { result } = renderHook(() => useConnectionPairing())

        await expect(
            result.current.pair('wc:topic@1?bridge=https%3A%2F%2Fb.example'),
        ).resolves.toMatchObject({ type: 'connect-failed' })
    })

    // The whole reason `ConnectionProposal.pairingId` exists: proposals and
    // errors fan out from every live connection, so another dApp's socket
    // flap must not read as this pairing being rejected.
    it('ignores a proposal and an error belonging to a different pairing', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b')
        await settlePairCall()
        emitError(new Error('someone else fell over'), 'pairing-b')
        emitProposal('pairing-b')
        await vi.advanceTimersByTimeAsync(8000)

        await expect(pairing).resolves.toEqual({
            type: 'timeout',
            pairingId: 'pairing-a',
        })
    })

    it('surfaces this pairing own error', async () => {
        const { result } = renderHook(() => useConnectionPairing())
        const error = new Error('wrong network')

        const pairing = result.current.pair('wc:topic@1?bridge=b')
        await settlePairCall()
        emitError(error, 'pairing-a')

        await expect(pairing).resolves.toEqual({ type: 'error', error })
    })

    // An errored pairing is over, but the connector is still registered with
    // its listeners bound: a bridge that later revives would replay the
    // handshake and pop an approval sheet with no user context.
    it('abandons the pairing whose socket never opened', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b')
        await settlePairCall()
        emitError(new Error('bridge unreachable'), 'pairing-a')
        await pairing

        expect(mockAbandonPairing).toHaveBeenCalledWith('pairing-a')
    })

    // A timeout keeps watching (the entry point's grace window), so it must
    // NOT abandon — that is the difference between the two outcomes.
    it('does not abandon a pairing that merely timed out', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b')
        await settlePairCall()
        await vi.advanceTimersByTimeAsync(8000)
        await pairing

        expect(mockAbandonPairing).not.toHaveBeenCalled()
    })

    it('does not abandon a pairing whose peer answered with a proposal', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b')
        await settlePairCall()
        emitProposal('pairing-a')
        await pairing

        expect(mockAbandonPairing).not.toHaveBeenCalled()
    })

    // The handler writes the origin onto the record at approval, so it has
    // to travel with `pair` — there is no app-side stamp any more.
    it('hands the pairing origin to the registry at pair time', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const pairing = result.current.pair('wc:topic@1?bridge=b', {
            origin: { source: 'external-browser', browserName: 'Chrome' },
        })
        await settlePairCall()
        emitProposal('pairing-a')
        await pairing

        expect(mockPair).toHaveBeenCalledWith('wc:topic@1?bridge=b', {
            origin: { source: 'external-browser', browserName: 'Chrome' },
        })
    })

    // One connector per handshake topic: a second one receives the bridge's
    // replay of the same handshake and queues a duplicate approval sheet.
    it('joins a second pairing for the same handshake topic onto the first', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const first = result.current.pair('wc:topic@1?bridge=b')
        const second = result.current.pair('wc:topic@1?bridge=b&key=other')
        await settlePairCall()
        emitProposal('pairing-a')

        await Promise.all([first, second])
        expect(mockPair).toHaveBeenCalledTimes(1)
    })

    it('keys the dedupe on the raw URI when the registry cannot describe it', async () => {
        const { result } = renderHook(() => useConnectionPairing())

        const first = result.current.pair('other:pairing-1')
        const second = result.current.pair('other:pairing-1')
        const third = result.current.pair('other:pairing-2')
        await settlePairCall()
        emitProposal('pairing-a')

        await Promise.all([first, second, third])
        expect(mockPair).toHaveBeenCalledTimes(2)
    })

    // The log sites that used to reach for the WalletConnect package's own
    // redaction get it from here instead, so nothing above the registry has to
    // know which protocol owns the URI to log a failure safely.
    it('describes a URI through the claiming handler, never returning the URI itself', () => {
        const { result } = renderHook(() => useConnectionPairing())

        const described = result.current.describeUri(
            'wc:topic@1?bridge=b&key=beef',
        )

        expect(described).toEqual({ topic: 'topic' })
        expect(JSON.stringify(described)).not.toContain('beef')
    })

    describe('watchLateOutcome', () => {
        it('reports a late proposal without abandoning the pairing', async () => {
            const { result } = renderHook(() => useConnectionPairing())

            const late = result.current.watchLateOutcome('pairing-a', 60_000)
            emitProposal('pairing-a')

            await expect(late).resolves.toEqual({ type: 'proposal' })
            expect(mockAbandonPairing).not.toHaveBeenCalled()
        })

        // Past the grace the connector is still bound for the request TTL;
        // abandoning it here is what stops a ghost approval sheet minutes on.
        it('abandons the pairing once the grace window passes with no answer', async () => {
            const { result } = renderHook(() => useConnectionPairing())

            const late = result.current.watchLateOutcome('pairing-a', 60_000)
            await vi.advanceTimersByTimeAsync(60_000)

            await expect(late).resolves.toEqual({ type: 'timeout' })
            expect(mockAbandonPairing).toHaveBeenCalledWith('pairing-a')
        })

        it('abandons the pairing when the late answer is an error', async () => {
            const { result } = renderHook(() => useConnectionPairing())
            const error = new Error('bridge gone')

            const late = result.current.watchLateOutcome('pairing-a', 60_000)
            emitError(error, 'pairing-a')

            await expect(late).resolves.toEqual({ type: 'error', error })
            expect(mockAbandonPairing).toHaveBeenCalledWith('pairing-a')
        })
    })
})
