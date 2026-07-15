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

import {
    bytesEqual,
    concatBytes,
    decodeFromBase64,
} from '@perawallet/wallet-core-shared'

/**
 * Algorand transaction domain-separation prefix. A transaction is signed over
 * `"TX" || <canonical txn msgpack>`; wire payloads (propose/cosign, hardware
 * handoff) carry the *unprefixed* msgpack, so the prefix is added before
 * signing/verifying and stripped when comparing against canonical bytes.
 */
export const TX_PREFIX = new Uint8Array([0x54, 0x58]) // "TX"

/** Prepend the "TX" domain-separation prefix to raw msgpack transaction bytes. */
export const addTxPrefix = (bytes: Uint8Array): Uint8Array =>
    concatBytes(TX_PREFIX, bytes)

/**
 * Strip a leading "TX" domain-separation prefix if present, otherwise return
 * the bytes unchanged — mirrors decoders that accept either form.
 */
export const stripTxPrefix = (bytes: Uint8Array): Uint8Array =>
    bytes.length >= TX_PREFIX.length &&
    bytes[0] === TX_PREFIX[0] &&
    bytes[1] === TX_PREFIX[1]
        ? bytes.subarray(TX_PREFIX.length)
        : bytes

/**
 * True when two lists of base64-encoded raw transactions are byte-for-byte
 * identical in order. Compared as decoded bytes so cosmetic base64 differences
 * (e.g. padding) can't cause a false mismatch; an entry that fails to decode is
 * treated as a mismatch. Order-sensitive on purpose — used to pin that a
 * server-returned transaction set matches exactly what the user reviewed.
 */
export const rawTransactionsMatch = (
    expectedBase64: string[],
    polledBase64: string[],
): boolean => {
    if (expectedBase64.length !== polledBase64.length) return false
    for (let i = 0; i < expectedBase64.length; i++) {
        try {
            if (
                !bytesEqual(
                    decodeFromBase64(expectedBase64[i]),
                    decodeFromBase64(polledBase64[i]),
                )
            ) {
                return false
            }
        } catch {
            return false
        }
    }
    return true
}
