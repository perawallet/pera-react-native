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

import { useWalletConnectStore } from '../store'
import { getConnectionErrorClientId } from '../errors'

export type WalletConnectSessionOutcome =
    | { type: 'session' }
    | { type: 'error'; error: Error }
    | { type: 'timeout' }

/**
 * Subscribe to the WalletConnect store and resolve as soon as one of three
 * things happens after a `connect`, all scoped to `pairingClientId` — the
 * connector this pairing created:
 *   - a session_request lands for this connector        → `session`
 *   - a connection error is surfaced for this connector → `error`
 *   - neither happens within `timeoutMs`                → `timeout`
 *
 * Scoping to the connector is essential: `connectionError` / `sessionRequests`
 * are shared across every active connector, so an unrelated dApp session that
 * errors (or a stale request) during the wait must NOT be mistaken for this
 * pairing being rejected.
 *
 * The `error` branch matters for interactive pairing flows (QR, webview):
 * when a handshake is rejected (most commonly scanned on the wrong network)
 * the dApp DID respond, so callers react immediately instead of blocking for
 * the full timeout and then reporting a misleading "no response" error. The
 * `timeout` branch still detects genuinely dead bridges (no event ever fires).
 */
export const waitForSessionOutcome = (
    pairingClientId: string,
    timeoutMs: number,
): Promise<WalletConnectSessionOutcome> =>
    new Promise(resolve => {
        const settle = (outcome: WalletConnectSessionOutcome) => {
            clearTimeout(timer)
            unsub()
            resolve(outcome)
        }
        const evaluate = (
            state: ReturnType<typeof useWalletConnectStore.getState>,
        ) => {
            const { connectionError } = state
            if (
                connectionError &&
                getConnectionErrorClientId(connectionError) === pairingClientId
            ) {
                settle({ type: 'error', error: connectionError })
                return
            }
            if (
                state.sessionRequests.some(r => r.clientId === pairingClientId)
            ) {
                settle({ type: 'session' })
            }
        }
        const timer = setTimeout(() => settle({ type: 'timeout' }), timeoutMs)
        const unsub = useWalletConnectStore.subscribe(evaluate)
        // Guard against the store settling synchronously in the gap between
        // `connect` resolving and this subscription being registered.
        evaluate(useWalletConnectStore.getState())
    })
