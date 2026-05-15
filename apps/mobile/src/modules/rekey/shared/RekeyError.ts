/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { toError } from '@perawallet/wallet-core-shared'

/**
 * The stage of the rekey flow that failed. Confirm screens map this to
 * failure-specific copy instead of a single generic "something went wrong".
 *
 *  - `user_rejected`     — source cancelled signing (Close on the Ledger
 *                          approval sheet, or rejected on device).
 *  - `build_failed`      — the unsigned rekey payment could not be built.
 *  - `signing_failed`    — the signing pipeline errored (Ledger timeout,
 *                          transport failure, device error).
 *  - `submission_failed` — algod rejected or could not receive the signed
 *                          group (fee too low, network, node error).
 */
export type RekeyErrorReason =
    | 'user_rejected'
    | 'build_failed'
    | 'signing_failed'
    | 'submission_failed'

/**
 * Typed error for every rekey failure. The {@link RekeyErrorReason} lets
 * callers branch on the failed stage; `originalError` preserves the raw
 * cause so it can still be routed through the algod error translator.
 *
 * The raw cause is accepted as `unknown` and normalized to an `Error` —
 * caught values are not guaranteed to be `Error` instances, and downstream
 * consumers (`useHandleRekeyError`, the algod translator) rely on it being
 * one.
 */
export class RekeyError extends Error {
    readonly reason: RekeyErrorReason
    readonly originalError?: Error

    constructor(reason: RekeyErrorReason, originalError?: unknown) {
        super(`Rekey failed: ${reason}`)
        this.name = 'RekeyError'
        this.reason = reason
        this.originalError =
            originalError === undefined ? undefined : toError(originalError)
    }
}
