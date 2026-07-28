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

import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

import { RekeyError } from '../errors'

import { compactSignedResults } from '@perawallet/wallet-core-blockchain'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

type AddSignRequestFn = (request: TransactionSignRequest) => void

/**
 * Upper bound on how long to wait for the signing pipeline to settle a rekey
 * request. Generous enough to never trip for legitimate signing — including a
 * Ledger approval on-device — but bounded so a dropped request surfaces as a
 * failure instead of hanging the confirm screen forever.
 */
const REKEY_SIGNING_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Hand the unsigned rekey transaction to the signing pipeline and resolve
 * with the signed bytes. Routing through the pipeline means the existing
 * Ledger approval overlay surfaces automatically when the source's auth
 * chain ends at a hardware account; KMS-only flows still resolve without UI.
 *
 * `sourceType: 'local'` keeps the request outside `INTERACTIVE_SOURCES`, so
 * the pipeline skips the standard review sheet — the rekey confirm screen has
 * already shown the full review (source, target, fee, warnings) and collected
 * an explicit confirmation, we just need the signature.
 */
export const requestRekeySignatures = (
    addSignRequest: AddSignRequestFn,
    source: { name: string; description: string },
    unsignedTxs: PeraTransaction[],
): Promise<PeraSignedTransaction[]> =>
    new Promise((resolve, reject) => {
        // Safety net: if the signing pipeline ever drops the request without
        // invoking approve / reject / error, the Promise would hang forever
        // and the confirm screen's CTA would stay stuck loading. `settle`
        // bounds the wait and guarantees the timeout is cleared once any
        // outcome lands.
        let settled = false
        const settle = (finish: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            finish()
        }

        const timeoutId = setTimeout(() => {
            settle(() =>
                reject(
                    new RekeyError(
                        'signing_failed',
                        new Error('Rekey signing timed out'),
                    ),
                ),
            )
        }, REKEY_SIGNING_TIMEOUT_MS)

        const request: TransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            txs: unsignedTxs,
            sourceMetadata: source,
            approve: async signed => {
                // Rekey is a single full-group headless sign (no per-slot
                // padding), so every entry is expected to be present — the
                // null filter is defensive only. A quantum signature is just
                // a `PeraSignedTransaction` with `pqsig` set, so undoing a
                // rekey to a quantum auth flows through the same shared
                // local-key path and submitAndAutoRefresh unchanged.
                settle(() => resolve(compactSignedResults(signed)))
            },
            reject: async () => {
                settle(() => reject(new RekeyError('user_rejected')))
            },
            error: async (err: Error) => {
                settle(() => reject(new RekeyError('signing_failed', err)))
            },
        }
        addSignRequest(request)
    })
