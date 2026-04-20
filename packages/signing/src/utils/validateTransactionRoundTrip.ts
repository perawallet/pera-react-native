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
    encodeTransactionRaw,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'

import { TransactionRoundTripError } from '../pipeline/errors'

const TX_PREFIX = new Uint8Array([0x54, 0x58]) // "TX"

const stripTxPrefix = (bytes: Uint8Array): Uint8Array => {
    if (
        bytes.length >= TX_PREFIX.length &&
        bytes[0] === TX_PREFIX[0] &&
        bytes[1] === TX_PREFIX[1]
    ) {
        return bytes.subarray(TX_PREFIX.length)
    }
    return bytes
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

/**
 * Re-encodes each decoded transaction and compares the result to the
 * original base64-encoded bytes that arrived with the request.
 *
 * Protects against silent-drop bugs in the decode path: if the decoder loses
 * a field (e.g. `rekeyTo`, `closeRemainderTo`) the user would approve a
 * transaction whose analysis/display does not reflect the bytes that will
 * actually be signed. A byte-for-byte mismatch aborts the signing request.
 *
 * Comparison is done on prefix-less msgpack bytes so the check mirrors
 * `decodeTransaction`'s accept-either semantics for the "TX" domain separator.
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
        const rawBytes = stripTxPrefix(decodeFromBase64(rawTransactionsBase64[i]))
        const reencoded = encodeTransactionRaw(transactions[i])
        if (!bytesEqual(reencoded, rawBytes)) {
            throw new TransactionRoundTripError(
                `Transaction at index ${i} failed round-trip validation — decoded representation does not match raw bytes`,
            )
        }
    }
}
