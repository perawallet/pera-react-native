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
import type { ConnectionErrorScope, ConnectionProposal } from '../models'
import {
    CONNECTION_PAIR_TIMEOUT_MS,
    pairConnection,
    resetConnectionPairingStateForTesting,
} from '../pairing'
import {
    CONNECTION_LATE_PAIRING_GRACE_MS,
    CONNECTION_OUTCOME_TIMEOUT_MS,
} from '../pairingOutcome'
import type { ConnectionRegistryClient } from '../registry'

type ProposalListener = (proposal: ConnectionProposal) => void
type ErrorListener = (error: Error, scope?: ConnectionErrorScope) => void

const makeRegistry = () => {
    const proposalListeners = new Set<ProposalListener>()
    const errorListeners = new Set<ErrorListener>()
    const registry: ConnectionRegistryClient = {
        pair: vi.fn(async () => 'pairing-a'),
        abandonPairing: vi.fn(),
        // Stands in for the v1 handler's parse; the sequence must not know
        // what a `wc:` URI looks like.
        describeUri: vi.fn((uri: string) => ({
            topic: /^wc:([^@?#]+)@/.exec(uri)?.[1] ?? null,
        })),
        networksFor: vi.fn(() => []),
        disconnect: vi.fn(async () => {}),
        disconnectAll: vi.fn(async () => {}),
        subscribeToProposals: listener => {
            proposalListeners.add(listener)
            return () => void proposalListeners.delete(listener)
        },
        subscribeToErrors: listener => {
            errorListeners.add(listener)
            return () => void errorListeners.delete(listener)
        },
    }
    return {
        registry,
        emitProposal: (pairingId?: string) => {
            for (const listener of [...proposalListeners]) {
                listener({ pairingId } as ConnectionProposal)
            }
        },
        emitError: (error: Error, pairingId?: string) => {
            for (const listener of [...errorListeners]) {
                listener(error, { pairingId })
            }
        },
    }
}

/** Lets the sequence get past `registry.pair` and arm its watch. */
const settlePairCall = async (): Promise<void> => {
    for (let tick = 0; tick < 8; tick += 1) await Promise.resolve()
}

describe('pairConnection', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetConnectionPairingStateForTesting()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('resolves with a session once the peer answers this pairing with a proposal', async () => {
        const { registry, emitProposal } = makeRegistry()

        const pairing = pairConnection(registry, 'wc:topic@1?bridge=b', {
            origin: { source: 'qr' },
        })
        await settlePairCall()
        emitProposal('pairing-a')

        await expect(pairing).resolves.toEqual({ type: 'session' })
        expect(registry.pair).toHaveBeenCalledWith('wc:topic@1?bridge=b', {
            origin: { source: 'qr' },
        })
        expect(registry.abandonPairing).not.toHaveBeenCalled()
    })

    // An errored pairing is over, but the connector is still registered with
    // its listeners bound: a bridge that later revives would replay the
    // handshake and pop an approval sheet with no user context.
    it('surfaces this pairing own error and abandons the pairing', async () => {
        const { registry, emitError } = makeRegistry()
        const error = new Error('wrong network')

        const pairing = pairConnection(registry, 'wc:topic@1?bridge=b')
        await settlePairCall()
        emitError(error, 'pairing-a')

        await expect(pairing).resolves.toEqual({ type: 'error', error })
        expect(registry.abandonPairing).toHaveBeenCalledWith('pairing-a')
    })

    // Proposals and errors fan out from every live connection, so another
    // dApp's socket flap must not read as this pairing being rejected.
    it('ignores answers for other pairings and times out with the pairing id, without abandoning', async () => {
        const { registry, emitProposal, emitError } = makeRegistry()

        const pairing = pairConnection(registry, 'wc:topic@1?bridge=b')
        await settlePairCall()
        emitError(new Error('someone else fell over'), 'pairing-b')
        emitProposal('pairing-b')
        await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)

        await expect(pairing).resolves.toEqual({
            type: 'timeout',
            pairingId: 'pairing-a',
        })
        expect(registry.abandonPairing).not.toHaveBeenCalled()
    })

    describe('watchLateOutcomeMs', () => {
        it('leaves the timeout result without a late watch when not asked for one', async () => {
            const { registry } = makeRegistry()

            const pairing = pairConnection(registry, 'wc:topic@1?bridge=b')
            await settlePairCall()
            await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)

            await expect(pairing).resolves.toEqual({
                type: 'timeout',
                pairingId: 'pairing-a',
            })
        })

        it('keeps the pairing alive when a proposal lands inside the grace', async () => {
            const { registry, emitProposal } = makeRegistry()

            const pairing = pairConnection(registry, 'wc:topic@1?bridge=b', {
                watchLateOutcomeMs: CONNECTION_LATE_PAIRING_GRACE_MS,
            })
            await settlePairCall()
            await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)
            const result = await pairing
            expect(result).toMatchObject({
                type: 'timeout',
                pairingId: 'pairing-a',
            })
            if (result.type !== 'timeout') return

            emitProposal('pairing-a')
            await vi.advanceTimersByTimeAsync(CONNECTION_LATE_PAIRING_GRACE_MS)

            await expect(result.lateOutcome).resolves.toEqual({
                type: 'proposal',
            })
            expect(registry.abandonPairing).not.toHaveBeenCalled()
        })

        // The connector stays bound for the request TTL; abandoning it here is
        // what stops a ghost approval sheet minutes on.
        it('abandons the pairing once the grace passes with no answer', async () => {
            const { registry } = makeRegistry()

            const pairing = pairConnection(registry, 'wc:topic@1?bridge=b', {
                watchLateOutcomeMs: CONNECTION_LATE_PAIRING_GRACE_MS,
            })
            await settlePairCall()
            await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)
            const result = await pairing
            if (result.type !== 'timeout') throw new Error(result.type)
            expect(registry.abandonPairing).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(CONNECTION_LATE_PAIRING_GRACE_MS)

            await expect(result.lateOutcome).resolves.toEqual({
                type: 'timeout',
            })
            expect(registry.abandonPairing).toHaveBeenCalledWith('pairing-a')
        })

        it('abandons the pairing when the late answer is an error', async () => {
            const { registry, emitError } = makeRegistry()
            const error = new Error('bridge gone')

            const pairing = pairConnection(registry, 'wc:topic@1?bridge=b', {
                watchLateOutcomeMs: CONNECTION_LATE_PAIRING_GRACE_MS,
            })
            await settlePairCall()
            await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)
            const result = await pairing
            if (result.type !== 'timeout') throw new Error(result.type)

            emitError(error, 'pairing-a')

            await expect(result.lateOutcome).resolves.toEqual({
                type: 'error',
                error,
            })
            expect(registry.abandonPairing).toHaveBeenCalledWith('pairing-a')
        })
    })

    it('honours a caller-supplied outcome budget', async () => {
        const { registry } = makeRegistry()

        const pairing = pairConnection(registry, 'wc:topic@1?bridge=b', {
            outcomeTimeoutMs: 15_000,
        })
        await settlePairCall()
        await vi.advanceTimersByTimeAsync(CONNECTION_OUTCOME_TIMEOUT_MS)
        let settled = false
        void pairing.then(() => {
            settled = true
        })
        await Promise.resolve()
        expect(settled).toBe(false)
        await vi.advanceTimersByTimeAsync(
            15_000 - CONNECTION_OUTCOME_TIMEOUT_MS,
        )

        await expect(pairing).resolves.toMatchObject({ type: 'timeout' })
    })

    it('reports a registry that refuses the URI as a connect failure', async () => {
        const { registry } = makeRegistry()
        vi.mocked(registry.pair).mockRejectedValueOnce(
            new Error('No handler accepts this URI'),
        )

        await expect(
            pairConnection(registry, 'wc:topic@1?bridge=b'),
        ).resolves.toMatchObject({
            type: 'connect-failed',
            error: new Error('No handler accepts this URI'),
        })
    })

    it('reports a hung pair step as a connect failure built by the caller factory', async () => {
        const { registry } = makeRegistry()
        vi.mocked(registry.pair).mockReturnValueOnce(new Promise(() => {}))
        class PairHung extends Error {}

        const pairing = pairConnection(registry, 'wc:topic@1?bridge=b', {
            pairTimeoutError: (operation, ms) =>
                new PairHung(`${operation} hung for ${ms}ms`),
        })
        await vi.advanceTimersByTimeAsync(CONNECTION_PAIR_TIMEOUT_MS)

        const outcome = await pairing
        expect(outcome.type).toBe('connect-failed')
        if (outcome.type !== 'connect-failed') return
        expect(outcome.error).toBeInstanceOf(PairHung)
        expect(outcome.error.message).toBe(
            `connections.pair hung for ${CONNECTION_PAIR_TIMEOUT_MS}ms`,
        )
    })

    it('falls back to a plain timeout error when no factory is supplied', async () => {
        const { registry } = makeRegistry()
        vi.mocked(registry.pair).mockReturnValueOnce(new Promise(() => {}))

        const pairing = pairConnection(registry, 'wc:topic@1?bridge=b')
        await vi.advanceTimersByTimeAsync(CONNECTION_PAIR_TIMEOUT_MS)

        await expect(pairing).resolves.toMatchObject({
            type: 'connect-failed',
            error: expect.objectContaining({
                message: expect.stringContaining('timed out'),
            }),
        })
    })

    // One connector per handshake topic: a second one receives the bridge's
    // replay of the same handshake and queues a duplicate approval sheet.
    it('joins a concurrent pairing for the same handshake topic onto the first', async () => {
        const { registry, emitProposal } = makeRegistry()

        const first = pairConnection(registry, 'wc:topic@1?bridge=b')
        const second = pairConnection(registry, 'wc:topic@1?bridge=b&key=other')
        await settlePairCall()
        emitProposal('pairing-a')

        expect(second).toBe(first)
        await expect(Promise.all([first, second])).resolves.toEqual([
            { type: 'session' },
            { type: 'session' },
        ])
        expect(registry.pair).toHaveBeenCalledTimes(1)
    })

    it('keys the dedupe on the raw URI when the registry cannot describe it', async () => {
        const { registry, emitProposal } = makeRegistry()

        const first = pairConnection(registry, 'other:pairing-1')
        const second = pairConnection(registry, 'other:pairing-1')
        const third = pairConnection(registry, 'other:pairing-2')
        await settlePairCall()
        emitProposal('pairing-a')

        await Promise.all([first, second, third])
        expect(registry.pair).toHaveBeenCalledTimes(2)
    })

    it('releases the topic once the pairing settles so a retry pairs again', async () => {
        const { registry, emitError } = makeRegistry()

        const first = pairConnection(registry, 'wc:topic@1?bridge=b')
        await settlePairCall()
        emitError(new Error('bridge unreachable'), 'pairing-a')
        await first

        void pairConnection(registry, 'wc:topic@1?bridge=b')

        expect(registry.pair).toHaveBeenCalledTimes(2)
    })
})
