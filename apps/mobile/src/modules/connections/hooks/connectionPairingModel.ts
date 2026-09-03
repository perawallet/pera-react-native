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

import type { ConnectionPairingOutcome } from '@perawallet/wallet-core-connections'
import type { ConnectionOriginSource } from '@perawallet/wallet-extension-connections'

// The contract both `useConnectionPairing` and its `.web` twin satisfy. Its
// own module because a `.web` file importing `./useConnectionPairing`
// resolves back to itself.

export type ConnectionPairingResult =
    /** `pair` itself failed — no handler took the URI, or the transport never came up. */
    | { type: 'connect-failed'; error: Error }
    /** The peer answered with a proposal; the approval sheet is on its way. */
    | { type: 'session' }
    /** The peer's answer was a failure (wrong network, rejected handshake, dead bridge). */
    | { type: 'error'; error: Error }
    /** Nothing came back in time. Carries the pairing id so the caller can keep watching. */
    | { type: 'timeout'; pairingId?: string }

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
}

export type UseConnectionPairingResult = {
    pair: (
        uri: string,
        options?: ConnectionPairingOptions,
    ) => Promise<ConnectionPairingResult>
    /**
     * Keeps watching a pairing the caller already gave up on, and abandons it
     * unless a proposal arrives within `timeoutMs`.
     */
    watchLateOutcome: (
        pairingId: string,
        timeoutMs: number,
    ) => Promise<ConnectionPairingOutcome>
    /**
     * Log-safe identifiers for a pairing URI, for the entry points that log a
     * pairing failure. Never the URI itself: its `key=`/`symKey=` is the
     * pairing secret and error-level log context ships to the crash reporter.
     * Empty when nothing claims the URI.
     */
    describeUri: (uri: string) => Record<string, string | null>
}
