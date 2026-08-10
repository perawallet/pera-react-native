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
    type WalletConnectSessionOutcome,
} from '@perawallet/wallet-core-walletconnect'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { withTimeout } from '@hooks/deeplink/handlers/timeout'

/** Guards `connect()` itself: constructing the WC v1 client is normally
 * synchronous, but a dead/unreachable bridge URL can hang the underlying
 * socket setup. */
const WC_CONNECT_TIMEOUT_MS = 10_000

export type WalletConnectPairingResult =
    | { type: 'connect-failed'; error: Error }
    | WalletConnectSessionOutcome

export type UseWalletConnectPairingResult = {
    /**
     * Starts a WC v1 pairing for `uri` and resolves once the outcome is
     * known: the paired connector produced a `session_request`, the
     * handshake errored (e.g. wrong network), the wait timed out, or
     * `connect()` itself threw (most commonly a dead/unreachable bridge).
     * Scoped to the connector this call creates — see
     * `waitForSessionOutcome`'s doc comment.
     */
    pair: (uri: string) => Promise<WalletConnectPairingResult>
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

    const pair = useCallback(
        async (uri: string): Promise<WalletConnectPairingResult> => {
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
            return waitForSessionOutcome(
                pairingClientId,
                WC_SESSION_OUTCOME_TIMEOUT_MS,
            )
        },
        [connect],
    )

    return { pair }
}
