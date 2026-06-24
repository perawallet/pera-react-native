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

import { concatBytes } from '@perawallet/wallet-core-shared'
import type { AlgokitClientInterface } from './types'

/**
 * Submit a group of already-encoded signed transactions (raw msgpack bytes)
 * to algod, returning the resulting transaction IDs.
 *
 * Unlike {@link submitSignedTransactionGroup}, this takes raw bytes and never
 * decodes/re-encodes them. That matters for assembled composite multisig
 * transactions: re-encoding could produce canonically-different bytes whose
 * per-participant signatures algod would reject. The shared-account swap
 * resolver interleaves pre-signed slot bytes with assembled multisig bytes and
 * submits the result here verbatim.
 *
 * Algod returns the txid of the first transaction in the group; callers that
 * need every id should decode the bytes separately. Returns an empty array
 * when algod's response carries no txid.
 */
export const submitRawSignedTransactionGroup = async (
    algokit: AlgokitClientInterface,
    rawSignedTransactions: Uint8Array[],
): Promise<string[]> => {
    const concatenated = concatBytes(...rawSignedTransactions)

    const response = (await algokit.client.algod.sendRawTransaction(
        concatenated,
    )) as { txid?: string | string[] }

    const ids: string[] = []
    if (typeof response?.txid === 'string') {
        ids.push(response.txid)
    } else if (Array.isArray(response?.txid)) {
        ids.push(...response.txid)
    }

    return ids
}
