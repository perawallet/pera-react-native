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

import { useCallback } from 'react'
import {
    CONNECTION_OUTCOME_TIMEOUT_MS,
    waitForPairingOutcome,
    type ConnectionPairingOutcome,
    type ConnectionRegistry,
} from '@perawallet/wallet-core-connections'
import { withTimeout } from '@hooks/deeplink/handlers/timeout'
import { useOptionalConnectionRegistry } from '../providers/connectionRegistryContext'
import type {
    ConnectionPairingOptions,
    ConnectionPairingResult,
    UseConnectionPairingResult,
} from './connectionPairingModel'

// v1 builds its bridge socket inside the connector constructor, and a dead
// bridge URL can hang that setup.
const PAIR_TIMEOUT_MS = 10_000

// One pairing per handshake topic: the same one-time link can reach the app
// twice (wrapped and raw delivery, a double tap), and a second connector on
// the topic would receive the replayed handshake and queue a duplicate sheet.
const inFlightPairings = new Map<string, Promise<ConnectionPairingResult>>()

export const resetConnectionPairingStateForTesting = (): void => {
    inFlightPairings.clear()
}

const toError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error))

const runPairing = async (
    registry: ConnectionRegistry,
    uri: string,
    options?: ConnectionPairingOptions,
): Promise<ConnectionPairingResult> => {
    const pairing = withTimeout(
        'connections.pair',
        PAIR_TIMEOUT_MS,
        registry.pair(uri, { origin: options?.origin }),
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
    return { type: 'timeout', pairingId }
}

/**
 * The "hand the URI to the registry, then wait for the peer's answer"
 * sequence every interactive pairing entry point shares (QR, pasted URI, OS
 * deep link, in-app browser bridge). Callers only see a
 * `ConnectionPairingResult`; which protocol answered is the registry's business.
 */
export const useConnectionPairing = (): UseConnectionPairingResult => {
    // Non-throwing: `useDeepLink` is rendered by onboarding screens above
    // `ConnectionsProvider`, which never pair.
    const registry = useOptionalConnectionRegistry()

    const watchLateOutcome = useCallback(
        async (
            pairingId: string,
            timeoutMs: number,
        ): Promise<ConnectionPairingOutcome> => {
            if (!registry) return { type: 'timeout' }
            const outcome = await waitForPairingOutcome(
                registry,
                pairingId,
                timeoutMs,
            )
            if (outcome.type !== 'proposal') registry.abandonPairing(pairingId)
            return outcome
        },
        [registry],
    )

    const describeUri = useCallback(
        (uri: string): Record<string, string | null> =>
            registry?.describeUri(uri) ?? {},
        [registry],
    )

    const pair = useCallback(
        (
            uri: string,
            options?: ConnectionPairingOptions,
        ): Promise<ConnectionPairingResult> => {
            if (!registry) {
                return Promise.resolve({
                    type: 'connect-failed',
                    error: new Error(
                        'Pairing was requested from outside ConnectionsProvider',
                    ),
                })
            }
            const key = describeUri(uri).topic ?? uri
            const inFlight = inFlightPairings.get(key)
            if (inFlight) return inFlight
            const pairing = runPairing(registry, uri, options).finally(() => {
                inFlightPairings.delete(key)
            })
            inFlightPairings.set(key, pairing)
            return pairing
        },
        [registry, describeUri],
    )

    return { pair, watchLateOutcome, describeUri }
}
