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

import { toError, withTimeout } from '@perawallet/wallet-core-shared'
import type { ConnectionOriginSource } from '@perawallet/wallet-extension-connections'
import {
    CONNECTION_OUTCOME_TIMEOUT_MS,
    waitForPairingOutcome,
    type ConnectionPairingOutcome,
} from './pairingOutcome'
import type { ConnectionRegistryClient } from './registry'

export type ConnectionPairingResult =
    /** `pair` itself failed — no handler took the URI, or the transport never came up. */
    | { type: 'connect-failed'; error: Error }
    /** The peer answered with a proposal; the approval sheet is on its way. */
    | { type: 'session' }
    /** The peer's answer was a failure (wrong network, rejected handshake, dead bridge). */
    | { type: 'error'; error: Error }
    /** Nothing came back in time. `lateOutcome` is the grace watch `watchLateOutcomeMs` armed. */
    | {
          type: 'timeout'
          pairingId?: string
          lateOutcome?: Promise<ConnectionPairingOutcome>
      }

export type ConnectionPairingOptions = {
    /**
     * Where this pairing entered the wallet; the handler records it on the
     * connection at approval so the post-approval sheets know whether to
     * offer "Return to the dApp" ('external-browser'), suppress themselves
     * ('in-app'), or show plainly ('qr').
     */
    origin?: {
        source: ConnectionOriginSource
        browserName?: string
    }
    /** Overrides `CONNECTION_OUTCOME_TIMEOUT_MS`. */
    outcomeTimeoutMs?: number
    /**
     * Builds the `connect-failed` error for a `pair` step that never
     * settled. The app supplies its own so its error copy can recognise a
     * timeout without this package knowing that vocabulary.
     */
    pairTimeoutError?: (operation: string, ms: number) => Error
    /**
     * After a timeout, keeps watching the pairing this long and abandons it
     * unless a proposal arrives. A handler keeps its listeners bound for the
     * full request TTL, so without this a straggler pops an approval sheet
     * minutes after the user was told the pairing failed.
     */
    watchLateOutcomeMs?: number
}

// v1 builds its bridge socket inside the connector constructor, and a dead
// bridge URL can hang that setup.
export const CONNECTION_PAIR_TIMEOUT_MS = 10_000

const PAIR_OPERATION = 'connections.pair'

// One pairing per handshake topic: the same one-time link can reach the app
// twice (wrapped and raw delivery, a double tap), and a second connector on
// the topic would receive the replayed handshake and queue a duplicate sheet.
const inFlightPairings = new Map<string, Promise<ConnectionPairingResult>>()

export const resetConnectionPairingStateForTesting = (): void => {
    inFlightPairings.clear()
}

const runPairing = async (
    registry: ConnectionRegistryClient,
    uri: string,
    options?: ConnectionPairingOptions,
): Promise<ConnectionPairingResult> => {
    const pairing = withTimeout(
        registry.pair(uri, { origin: options?.origin }),
        CONNECTION_PAIR_TIMEOUT_MS,
        PAIR_OPERATION,
        options?.pairTimeoutError,
    )
    // Armed before `pair` resolves so an answer arriving in the same tick
    // the transport comes up is still attributed to this pairing.
    const outcome = waitForPairingOutcome(
        registry,
        pairing,
        options?.outcomeTimeoutMs ?? CONNECTION_OUTCOME_TIMEOUT_MS,
    )

    let pairingId: string
    let answer: ConnectionPairingOutcome
    try {
        ;[pairingId, answer] = await Promise.all([pairing, outcome])
    } catch (error) {
        return { type: 'connect-failed', error: toError(error) }
    }

    if (answer.type === 'proposal') return { type: 'session' }
    if (answer.type === 'error') {
        // Terminal, unlike a timeout: nothing keeps watching, so the bound
        // connector has to go now or a reviving bridge pops a ghost sheet.
        registry.abandonPairing(pairingId)
        return { type: 'error', error: answer.error }
    }
    if (options?.watchLateOutcomeMs === undefined) {
        return { type: 'timeout', pairingId }
    }
    return {
        type: 'timeout',
        pairingId,
        lateOutcome: watchLateOutcome(
            registry,
            pairingId,
            options.watchLateOutcomeMs,
        ),
    }
}

const watchLateOutcome = async (
    registry: ConnectionRegistryClient,
    pairingId: string,
    graceMs: number,
): Promise<ConnectionPairingOutcome> => {
    const outcome = await waitForPairingOutcome(registry, pairingId, graceMs)
    if (outcome.type !== 'proposal') registry.abandonPairing(pairingId)
    return outcome
}

/**
 * The "hand the URI to the registry, then wait for the peer's answer"
 * sequence every interactive pairing entry point shares (QR, pasted URI, OS
 * deep link, in-app browser bridge). Callers only see a
 * `ConnectionPairingResult`; which protocol answered is the registry's business.
 */
export const pairConnection = (
    registry: ConnectionRegistryClient,
    uri: string,
    options?: ConnectionPairingOptions,
): Promise<ConnectionPairingResult> => {
    const key = registry.describeUri(uri).topic ?? uri
    const inFlight = inFlightPairings.get(key)
    if (inFlight) return inFlight
    const pairing = runPairing(registry, uri, options).finally(() => {
        inFlightPairings.delete(key)
    })
    inFlightPairings.set(key, pairing)
    return pairing
}
