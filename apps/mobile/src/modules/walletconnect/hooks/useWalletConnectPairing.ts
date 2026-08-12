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
    useWalletConnect,
    waitForSessionOutcome,
    WC_SESSION_OUTCOME_TIMEOUT_MS,
    type WalletConnectPairingOriginSource,
    type WalletConnectSessionOutcome,
} from '@perawallet/wallet-core-walletconnect'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { withTimeout } from '@hooks/deeplink/handlers/timeout'
import { useReturnToDappStore } from '../stores/useReturnToDappStore'

/** Guards `connect()` itself: constructing the WC v1 client is normally
 * synchronous, but a dead/unreachable bridge URL can hang the underlying
 * socket setup. */
const WC_CONNECT_TIMEOUT_MS = 10_000

/**
 * In-flight pairings keyed by handshake topic. The same one-time pairing
 * can reach the app twice (wrapped and raw delivery of one link, or a
 * double tap past the listener's 1.5s exact-string window); a second
 * connector on the same topic would receive the bridge-replayed
 * `session_request` again and queue a duplicate approval sheet. Joining the
 * live promise keeps one connector per topic; entries clear on settle so a
 * deliberate retry after a failure gets a fresh connector.
 */
const inFlightPairings = new Map<string, Promise<WalletConnectPairingResult>>()

const getHandshakeTopic = (uri: string): string | null => {
    const match = uri.match(/^wc:([^@]+)@/)
    return match ? match[1] : null
}

export const resetPairingStateForTesting = (): void => {
    inFlightPairings.clear()
}

export type WalletConnectPairingResult =
    | { type: 'connect-failed'; error: Error }
    | Exclude<WalletConnectSessionOutcome, { type: 'timeout' }>
    | {
          type: 'timeout'
          /**
           * The timed-out pairing's connector, set on native so the caller
           * can keep watching for a late `session_request` and eventually
           * `abandonPairing` it. The web twin never sets it (offscreen owns
           * the connector lifecycle there).
           */
          clientId?: string
      }

export type WalletConnectPairingOptions = {
    /**
     * Where this pairing entered the wallet, recorded per connector so the
     * post-approval sheets know whether to offer "Return to the dApp"
     * ('external-browser'), suppress themselves ('in-app'), or show plainly
     * ('qr').
     */
    origin?: {
        source: WalletConnectPairingOriginSource
        browserName?: string
    }
    /**
     * Overrides `WC_SESSION_OUTCOME_TIMEOUT_MS`. Deep-link pairings pass
     * `WC_DEEPLINK_SESSION_OUTCOME_TIMEOUT_MS` — see its doc comment.
     */
    outcomeTimeoutMs?: number
}

export type UseWalletConnectPairingResult = {
    /**
     * Starts a WC v1 pairing for `uri` and resolves once the outcome is
     * known: the paired connector produced a `session_request`, the
     * handshake errored (e.g. wrong network), the wait timed out, or
     * `connect()` itself threw (most commonly a dead/unreachable bridge).
     * Scoped to the connector this call creates — see
     * `waitForSessionOutcome`'s doc comment.
     */
    pair: (
        uri: string,
        options?: WalletConnectPairingOptions,
    ) => Promise<WalletConnectPairingResult>
}

/**
 * Owns the "connect, then wait for the first outcome" sequence shared by
 * every interactive WC v1 pairing entry point (QR scan, pasted URI, the
 * Discover webview bridge). Extracted out of `useDeepLink` /
 * `usePeraWebviewInterface` so each call site only reacts to a
 * `WalletConnectPairingResult` — the surrounding deeplink/webview dispatch
 * logic (which stays identical on both platforms) never has to duplicate
 * the connect+timeout+wait dance itself.
 *
 * This is also the seam the web twin (`useWalletConnectPairing.web.ts`)
 * uses to swap the connector-owning half without touching either call
 * site: on web, offscreen is the sole owner of WC connectors (see
 * `apps/browser/src/offscreen/walletconnect/wcHost.ts`), so merely calling
 * `useWalletConnect` here — even just for `connect` — would register a
 * second connector handler binder from a UI surface.
 */
export const useWalletConnectPairing = (): UseWalletConnectPairingResult => {
    const { network } = useNetwork()
    const { connect } = useWalletConnect(network)

    const runPairing = useCallback(
        async (
            uri: string,
            options?: WalletConnectPairingOptions,
        ): Promise<WalletConnectPairingResult> => {
            let pairingClientId: string
            try {
                pairingClientId = await withTimeout(
                    'walletConnect.connect',
                    WC_CONNECT_TIMEOUT_MS,
                    connect({ connection: { uri } }),
                )
            } catch (error) {
                return { type: 'connect-failed', error: error as Error }
            }
            // Written before the outcome wait: the session_request can land
            // mid-wait and the approval/success sheets read this store.
            if (options?.origin) {
                useReturnToDappStore
                    .getState()
                    .setReturnContext(pairingClientId, {
                        origin: options.origin.source,
                        browserName: options.origin.browserName,
                    })
            }
            const outcome = await waitForSessionOutcome(
                pairingClientId,
                options?.outcomeTimeoutMs ?? WC_SESSION_OUTCOME_TIMEOUT_MS,
            )
            // Errored handshakes never reach the success sheet. A timeout
            // keeps its context: a late session_request may still surface
            // the request, and the CTA should survive that path.
            if (options?.origin && outcome.type === 'error') {
                useReturnToDappStore
                    .getState()
                    .clearReturnContext(pairingClientId)
            }
            return outcome.type === 'timeout'
                ? { ...outcome, clientId: pairingClientId }
                : outcome
        },
        [connect],
    )

    const pair = useCallback(
        (
            uri: string,
            options?: WalletConnectPairingOptions,
        ): Promise<WalletConnectPairingResult> => {
            const topic = getHandshakeTopic(uri)
            if (!topic) return runPairing(uri, options)
            const inFlight = inFlightPairings.get(topic)
            if (inFlight) return inFlight
            const pairing = runPairing(uri, options).finally(() => {
                inFlightPairings.delete(topic)
            })
            inFlightPairings.set(topic, pairing)
            return pairing
        },
        [runPairing],
    )

    return { pair }
}
