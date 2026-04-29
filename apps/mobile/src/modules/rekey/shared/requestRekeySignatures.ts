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

import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

/**
 * User cancelled a rekey signing request from the signing pipeline (e.g.
 * pressed Close on the Ledger Approval sheet, or rejected on device).
 * Callers should treat this as a non-fatal cancellation.
 */
export class RekeyUserRejectedError extends Error {
    constructor() {
        super('Rekey signing was cancelled by the user')
        this.name = 'RekeyUserRejectedError'
    }
}

type AddSignRequestFn = (request: TransactionSignRequest) => void

/**
 * Hand the unsigned rekey transaction to the signing pipeline and resolve
 * with the signed bytes. Routing through the pipeline means the existing
 * Ledger approval overlay surfaces automatically when the source's auth
 * chain ends at a hardware account; KMS-only flows still resolve without UI.
 *
 * `headless: true` because the rekey confirm screen has already shown the
 * full review (source, target, fee, warnings) and collected an explicit
 * confirmation — we just need the signature, not the standard review sheet.
 */
export const requestRekeySignatures = (
    addSignRequest: AddSignRequestFn,
    source: { name: string; description: string },
    unsignedTxs: PeraTransaction[],
): Promise<PeraSignedTransaction[]> =>
    new Promise((resolve, reject) => {
        const request: TransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            headless: true,
            txs: unsignedTxs,
            sourceMetadata: source,
            approve: async signed => {
                resolve(signed)
            },
            reject: async () => {
                reject(new RekeyUserRejectedError())
            },
            error: async (err: Error) => {
                reject(err)
            },
        }
        addSignRequest(request)
    })
