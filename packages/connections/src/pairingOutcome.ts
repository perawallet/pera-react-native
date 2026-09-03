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

import type { Optional } from '@perawallet/wallet-core-shared'
import type { ConnectionRegistry } from './registry'

/** Default budget for the peer's answer once the transport is up. */
export const CONNECTION_OUTCOME_TIMEOUT_MS = 8000

/**
 * Deep links pay for an app switch plus the bridge replaying the topic's
 * pending history, so they get a longer budget than an in-app pairing.
 */
export const CONNECTION_DEEPLINK_OUTCOME_TIMEOUT_MS = 15_000

/**
 * How long a timed-out pairing is still watched for a late answer before it
 * is abandoned. A handler keeps its listeners bound for the full request TTL,
 * so a straggler would otherwise pop an approval sheet minutes after the user
 * was told the pairing failed.
 */
export const CONNECTION_LATE_PAIRING_GRACE_MS = 60_000

export type ConnectionPairingOutcome =
    | { type: 'proposal' }
    | { type: 'error'; error: Error }
    | { type: 'timeout' }

type PairingOutcomeSource = Pick<
    ConnectionRegistry,
    'subscribeToProposals' | 'subscribeToErrors'
>

type SeenEvent = {
    pairingId: string
    outcome: ConnectionPairingOutcome
}

/**
 * Resolves once the peer answers one pairing — with a proposal, an error, or
 * neither within `timeoutMs`. Proposals and errors fan out from every live
 * connection, so only events scoped to `pairingId` count.
 *
 * Accepts the pending `registry.pair()` promise so the watch is armed before
 * the transport comes up: v1 opens its socket inside the connector
 * constructor and an answer can land before the pairing id is known. Events
 * seen in that window are buffered and matched by id once it is, never
 * assumed to be ours. The budget starts on call, and a rejected pairing
 * promise rejects this too.
 *
 * Without an id (a caller that was handed none) nothing can be attributed, so
 * only the timeout settles it.
 */
export const waitForPairingOutcome = (
    registry: PairingOutcomeSource,
    pairingId: Optional<string> | PromiseLike<Optional<string>>,
    timeoutMs: number,
): Promise<ConnectionPairingOutcome> =>
    new Promise((resolve, reject) => {
        let knownId: Optional<string> = undefined
        let identified = false
        let settled = false
        const seen: SeenEvent[] = []

        const finish = (): void => {
            settled = true
            clearTimeout(timer)
            unsubscribeProposals()
            unsubscribeErrors()
        }
        const settle = (outcome: ConnectionPairingOutcome): void => {
            if (settled) return
            finish()
            resolve(outcome)
        }

        const record = (
            candidateId: Optional<string>,
            outcome: ConnectionPairingOutcome,
        ): void => {
            if (settled || candidateId === undefined) return
            if (!identified) {
                seen.push({ pairingId: candidateId, outcome })
                return
            }
            if (candidateId === knownId) settle(outcome)
        }

        const identify = (id: Optional<string>): void => {
            if (settled) return
            identified = true
            knownId = id
            if (id === undefined) return
            const buffered = seen.find(event => event.pairingId === id)
            if (buffered) settle(buffered.outcome)
        }

        const unsubscribeProposals = registry.subscribeToProposals(proposal => {
            record(proposal.pairingId, { type: 'proposal' })
        })
        const unsubscribeErrors = registry.subscribeToErrors((error, scope) => {
            record(scope?.pairingId, { type: 'error', error })
        })
        const timer = setTimeout(() => settle({ type: 'timeout' }), timeoutMs)

        if (isPromiseLike(pairingId)) {
            pairingId.then(identify, (error: unknown) => {
                if (settled) return
                finish()
                reject(error)
            })
        } else {
            identify(pairingId)
        }
    })

const isPromiseLike = <T>(value: T | PromiseLike<T>): value is PromiseLike<T> =>
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
