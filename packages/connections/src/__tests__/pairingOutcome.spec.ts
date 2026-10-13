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
    CONNECTION_DEEPLINK_OUTCOME_TIMEOUT_MS,
    CONNECTION_LATE_PAIRING_GRACE_MS,
    CONNECTION_OUTCOME_TIMEOUT_MS,
    waitForPairingOutcome,
} from '../pairingOutcome'

type ProposalListener = (proposal: ConnectionProposal) => void
type ErrorListener = (error: Error, scope?: ConnectionErrorScope) => void

const makeRegistry = () => {
    const proposalListeners = new Set<ProposalListener>()
    const errorListeners = new Set<ErrorListener>()
    return {
        proposalListeners,
        errorListeners,
        registry: {
            subscribeToProposals: (listener: ProposalListener) => {
                proposalListeners.add(listener)
                return () => void proposalListeners.delete(listener)
            },
            subscribeToErrors: (listener: ErrorListener) => {
                errorListeners.add(listener)
                return () => void errorListeners.delete(listener)
            },
        },
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

describe('waitForPairingOutcome', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('resolves with a proposal answered on this pairing', async () => {
        const { registry, emitProposal } = makeRegistry()

        const outcome = waitForPairingOutcome(registry, 'pairing-a', 8000)
        emitProposal('pairing-a')

        await expect(outcome).resolves.toEqual({ type: 'proposal' })
    })

    it('resolves with the error scoped to this pairing', async () => {
        const { registry, emitError } = makeRegistry()
        const error = new Error('wrong network')

        const outcome = waitForPairingOutcome(registry, 'pairing-a', 8000)
        emitError(error, 'pairing-a')

        await expect(outcome).resolves.toEqual({ type: 'error', error })
    })

    // Proposals and errors fan out from every live connection, so another
    // dApp's socket flap must not read as this pairing being rejected.
    it('ignores answers belonging to a different pairing and times out', async () => {
        const { registry, emitProposal, emitError } = makeRegistry()

        const outcome = waitForPairingOutcome(registry, 'pairing-a', 8000)
        emitError(new Error('someone else fell over'), 'pairing-b')
        emitProposal('pairing-b')
        emitProposal(undefined)
        await vi.advanceTimersByTimeAsync(8000)

        await expect(outcome).resolves.toEqual({ type: 'timeout' })
    })

    it('unsubscribes from the registry once settled', async () => {
        const { registry, emitProposal, proposalListeners, errorListeners } =
            makeRegistry()

        const outcome = waitForPairingOutcome(registry, 'pairing-a', 8000)
        emitProposal('pairing-a')
        await outcome

        expect(proposalListeners.size).toBe(0)
        expect(errorListeners.size).toBe(0)
    })

    it('unsubscribes when the budget runs out', async () => {
        const { registry, proposalListeners, errorListeners } = makeRegistry()

        const outcome = waitForPairingOutcome(registry, 'pairing-a', 8000)
        await vi.advanceTimersByTimeAsync(8000)
        await outcome

        expect(proposalListeners.size).toBe(0)
        expect(errorListeners.size).toBe(0)
    })

    describe('with a pairing still being established', () => {
        // v1 opens its socket inside the connector constructor, so the
        // peer's answer can land before `registry.pair` has resolved with
        // the id to match it against.
        it('attributes an answer that arrived before the pairing id was known', async () => {
            const { registry, emitProposal } = makeRegistry()
            let resolvePairing: (id: string) => void = () => {}
            const pairing = new Promise<string>(resolve => {
                resolvePairing = resolve
            })

            const outcome = waitForPairingOutcome(registry, pairing, 8000)
            emitProposal('pairing-a')
            resolvePairing('pairing-a')

            await expect(outcome).resolves.toEqual({ type: 'proposal' })
        })

        it('does not assume an early answer for another pairing is ours', async () => {
            const { registry, emitProposal } = makeRegistry()
            let resolvePairing: (id: string) => void = () => {}
            const pairing = new Promise<string>(resolve => {
                resolvePairing = resolve
            })

            const outcome = waitForPairingOutcome(registry, pairing, 8000)
            emitProposal('pairing-b')
            resolvePairing('pairing-a')
            await vi.advanceTimersByTimeAsync(8000)

            await expect(outcome).resolves.toEqual({ type: 'timeout' })
        })

        it('starts the budget when called, not when the id arrives', async () => {
            const { registry } = makeRegistry()
            const pairing = new Promise<string>(() => {})

            const outcome = waitForPairingOutcome(registry, pairing, 8000)
            await vi.advanceTimersByTimeAsync(8000)

            await expect(outcome).resolves.toEqual({ type: 'timeout' })
        })

        it('rejects with the pairing failure and unsubscribes', async () => {
            const { registry, proposalListeners, errorListeners } =
                makeRegistry()
            const failure = new Error('no handler accepts this URI')

            const outcome = waitForPairingOutcome(
                registry,
                Promise.reject(failure),
                8000,
            )

            await expect(outcome).rejects.toBe(failure)
            expect(proposalListeners.size).toBe(0)
            expect(errorListeners.size).toBe(0)
        })
    })

    // A pairing without an id (the web twin hands none back) can never be
    // correlated, so only the budget can settle it — an unrelated proposal
    // must not be mistaken for its answer.
    it('can only time out when there is no pairing id to match on', async () => {
        const { registry, emitProposal } = makeRegistry()

        const outcome = waitForPairingOutcome(registry, undefined, 8000)
        emitProposal('pairing-a')
        emitProposal(undefined)
        await vi.advanceTimersByTimeAsync(8000)

        await expect(outcome).resolves.toEqual({ type: 'timeout' })
    })

    it('publishes the three pairing budgets', () => {
        expect(CONNECTION_OUTCOME_TIMEOUT_MS).toBe(8000)
        expect(CONNECTION_DEEPLINK_OUTCOME_TIMEOUT_MS).toBe(15_000)
        expect(CONNECTION_LATE_PAIRING_GRACE_MS).toBe(60_000)
    })
})
