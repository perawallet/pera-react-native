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

import {
    encodeTransaction,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import { TransactionRoundTripError } from '../pipeline/errors'

/**
 * Re-encodes each decoded transaction and compares the result to the
 * original base64-encoded bytes that arrived with the request.
 *
 * Protects against silent-drop bugs in the decode path: if the decoder loses
 * a field (e.g. `rekeyTo`, `closeRemainderTo`) the user would approve a
 * transaction whose analysis/display does not reflect the bytes that will
 * actually be signed. A byte-for-byte mismatch aborts the signing request.
 */
export const validateTransactionRoundTrip = (
    transactions: PeraTransaction[],
    rawTransactionsBase64: string[],
): void => {
    if (transactions.length !== rawTransactionsBase64.length) {
        throw new TransactionRoundTripError(
            `Transaction count mismatch: ${transactions.length} decoded vs ${rawTransactionsBase64.length} raw`,
        )
    }

    for (let i = 0; i < transactions.length; i++) {
        const reencoded = encodeToBase64(encodeTransaction(transactions[i]))
        if (reencoded !== rawTransactionsBase64[i]) {
            throw new TransactionRoundTripError(
                `Transaction at index ${i} failed round-trip validation — decoded representation does not match raw bytes`,
            )
        }
    }
}
