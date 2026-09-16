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

// Subpaths, never the barrels: this module is the service worker's gate, and
// either barrel drags react-native into an MV3 bundle. The caps still have one
// definition each, so this gate and the registry's zod schema cannot drift.
import { ARC0001_MAX_TXN_B64_LENGTH } from '@perawallet/wallet-core-blockchain/arc0001/limits'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing/constants'
import type { JsonRpcRequest } from './codec'
import { MAX_DAPP_REQUEST_JSON_LENGTH } from './protocol'

export const MAX_ID_LENGTH = 64
export const MAX_METHOD_LENGTH = 64

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

/**
 * Cheap shape/size gate for the service worker, run before a request is
 * forwarded or parked anywhere. The full zod validation still runs in the
 * registry; this only keeps a hostile page from making the worker hold a
 * multi-megabyte payload while an approval surface opens to show an error.
 */
export const isWithinDappPayloadBounds = (request: JsonRpcRequest): boolean => {
    if (String(request.id).length > MAX_ID_LENGTH) return false
    if (request.method.length > MAX_METHOD_LENGTH) return false
    if (JSON.stringify(request).length > MAX_DAPP_REQUEST_JSON_LENGTH)
        return false
    if (request.method !== 'requestTransactionSigning') return true

    const txns = isRecord(request.params) ? request.params.txns : undefined
    if (!Array.isArray(txns) || txns.length === 0) return false
    if (txns.length > MAX_TRANSACTION_SIGN_REQUESTS) return false

    return txns.every(
        entry =>
            isRecord(entry) &&
            typeof entry.txn === 'string' &&
            entry.txn.length > 0 &&
            entry.txn.length <= ARC0001_MAX_TXN_B64_LENGTH,
    )
}
