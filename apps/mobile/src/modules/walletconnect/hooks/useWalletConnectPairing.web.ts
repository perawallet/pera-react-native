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
    onPairOutcome,
    sendWcControlMessage,
} from '@perawallet/wallet-extension-platform-chrome'
import { WC_SESSION_OUTCOME_TIMEOUT_MS } from '@perawallet/wallet-core-walletconnect'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { withTimeout } from '@hooks/deeplink/handlers/timeout'
import type {
    UseWalletConnectPairingResult,
    WalletConnectPairingOptions,
    WalletConnectPairingResult,
} from './useWalletConnectPairing'

/** Guards the control-message send itself (e.g. an unresponsive service
 * worker/offscreen document) — mirrors native's `connect()` timeout. */
const WC_PAIR_TIMEOUT_MS = 10_000

/**
 * Races the matching `pair-outcome` broadcast against a local timer, mirroring
 * native's `waitForSessionOutcome` but keyed on `correlationId` over
 * `chrome.runtime` messaging instead of `clientId` over the WC store (which
 * `useWalletConnect`'s handlers — absent from this realm on web — are what
 * write to). Returns a `cancel` so a caller whose control-message *send*
 * itself failed can tear the listener/timer down instead of leaving them
 * live until they time out on their own.
 */
const waitForPairOutcome = (
    correlationId: string,
    timeoutMs: number,
): { promise: Promise<WalletConnectPairingResult>; cancel: () => void } => {
    let settle: (result: WalletConnectPairingResult) => void = () => {}
    const promise = new Promise<WalletConnectPairingResult>(resolve => {
        settle = resolve
    })

    const finish = (result: WalletConnectPairingResult): void => {
        clearTimeout(timer)
        unsubscribe()
        settle(result)
    }

    const timer = setTimeout(() => finish({ type: 'timeout' }), timeoutMs)
    const unsubscribe = onPairOutcome(message => {
        if (message.correlationId !== correlationId) return
        switch (message.outcome.type) {
            case 'session': {
                finish({ type: 'session' })
                return
            }
            case 'error': {
                finish({
                    type: 'error',
                    error: new Error(message.outcome.reason),
                })
                return
            }
            case 'timeout': {
                finish({ type: 'timeout' })
                return
            }
        }
    })

    return {
        promise,
        cancel: () => {
            clearTimeout(timer)
            unsubscribe()
        },
    }
}

/**
 * Web twin. Offscreen — not this UI surface — is the sole owner of WC
 * connectors on web (see `wcHost.ts`), so pairing here sends a `pair { uri,
 * correlationId }` control message instead of going through native's
 * `connect` (off `useWalletConnect`), which would construct and register a
 * second connector from a UI realm.
 *
 * The `correlationId` is what closes the gap the previous version of this
 * hook had to leave open: offscreen owns the connector and (via
 * `bindHeadlessHandlers`) the network-mismatch rejection, so it — not this
 * UI realm — is the only place that can know a pairing failed. `wcHost.ts`
 * records `correlationId` against the connector's `clientId` at pair time
 * and reports back over a `pair-outcome` broadcast once it knows the
 * outcome; `waitForPairOutcome` above races that broadcast against the same
 * 8s budget native's `waitForSessionOutcome` uses, so this resolves to the
 * exact same `WalletConnectPairingResult` union native does — the shared
 * `useDeepLink`/`usePeraWebviewInterface` call sites need no new branches.
 */
export const useWalletConnectPairing = (): UseWalletConnectPairingResult => {
    const pair = useCallback(
        async (
            uri: string,
            // Accepted for signature parity with native and ignored: the
            // extension never deep-links out to a mobile browser, so no
            // return context is ever recorded on web.
            _options?: WalletConnectPairingOptions,
        ): Promise<WalletConnectPairingResult> => {
            const correlationId = generateOrderedUniqueId()
            const outcome = waitForPairOutcome(
                correlationId,
                WC_SESSION_OUTCOME_TIMEOUT_MS,
            )
            try {
                await withTimeout(
                    'walletConnect.pair',
                    WC_PAIR_TIMEOUT_MS,
                    sendWcControlMessage({ kind: 'pair', uri, correlationId }),
                )
            } catch (error) {
                outcome.cancel()
                return { type: 'connect-failed', error: error as Error }
            }
            return outcome.promise
        },
        [],
    )

    return { pair }
}
