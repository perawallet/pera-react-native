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

import { AlgorandPermission } from './models'

export const PERA_CLIENT_META = {
    name: 'Pera Wallet',
    description: 'Simply the best Algorand wallet',
    url: 'https://perawallet.app',
    icons: ['https://perawallet.app/favicon.ico'],
}

export const ALL_PERMISSIONS = Object.values(AlgorandPermission)

/**
 * How long to wait for a WalletConnect bridge socket to (re)open before a
 * delivery attempt is treated as failed.
 *
 * iOS suspends the socket while the app is backgrounded; on return the
 * connector registry recreates it and waits up to this budget for the
 * `transport_open` event before throwing a
 * `WalletConnectConnectionTimeoutError`.
 */
export const WC_DELIVERY_TIMEOUT_MS = 8000

/**
 * How long a queued session request stays approvable. dApps time out
 * their side of the WC v1 handshake much sooner, so a request that sat
 * in the queue through an outage must expire rather than pop a sheet
 * whose approval would be queued into a dead socket.
 */
export const SESSION_REQUEST_TTL_MS = 5 * 60 * 1000

/**
 * How long a caller waits for a freshly paired connector's first
 * `session_request` (or an error) before treating the pairing as timed out.
 * Shared by native's `useWalletConnectPairing` (via `waitForSessionOutcome`),
 * its web twin (via `waitForPairOutcome`), and the offscreen host's own
 * leak-prevention timer for `pairingCorrelations` (`wcHost.ts`) — all three
 * must agree on this budget, since the host's timer exists specifically to
 * outlive every caller's own wait.
 */
export const WC_SESSION_OUTCOME_TIMEOUT_MS = 8000

/**
 * Outcome budget for pairings that arrive via an OS deep link from a mobile
 * browser. That path pays for an app switch the 8s default never sees: a
 * fresh WSS handshake to the bridge, the topic subscribe, and the bridge
 * replaying the dApp's queued `session_request` — possibly on a device that
 * just cold-started (the clock can also run behind the PIN screen). QR and
 * in-app-browser pairings keep the 8s default; they pair from a warm,
 * foregrounded app.
 */
export const WC_DEEPLINK_SESSION_OUTCOME_TIMEOUT_MS = 15_000

/**
 * After a pairing outcome times out, how much longer a late
 * `session_request` is still honored before the pairing connector is
 * abandoned (`abandonPairing`). Within the grace, a straggler session still
 * opens the approval sheet; past it, nothing may ever pop — the request TTL
 * alone would otherwise let a ghost sheet appear minutes later.
 */
export const WC_LATE_SESSION_GRACE_MS = 60_000

export {
    MAX_DATA_SIGN_REQUESTS,
    MAX_TRANSACTION_SIGN_REQUESTS,
    // Hard cap on the serialized size of an ARC-60 `algo_signData` request.
    // Canonical definition lives in the signing package alongside the shared
    // wire schema; re-exported here for existing WC importers.
    ARC60_MAX_REQUEST_BYTES,
} from '@perawallet/wallet-core-signing'
