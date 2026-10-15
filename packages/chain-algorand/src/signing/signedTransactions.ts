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

import type {
    ChainScope,
    PeraSignedTransaction,
    SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    TransportError,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import {
    decodeSignedTransaction,
    encodeSignedTransaction,
} from '../blockchain/utils/transact'

export const toSignedAlgorandTransaction = (
    signed: PeraSignedTransaction,
    scope: ChainScope,
): SignedTransaction => ({
    scope,
    id: signed.txn.txID(),
    bytes: encodeSignedTransaction(signed),
})

// The bytes are kept as given: a signature another party made must reach the
// node exactly as they encoded it.
export const signedAlgorandTransactionFromBytes = (
    bytes: Uint8Array,
    scope: ChainScope,
): SignedTransaction => ({
    scope,
    id: decodeSignedTransaction(bytes).txn.txID(),
    bytes,
})

export const algorandSignedTransactionsOf = (
    result: SigningResult,
    scope: ChainScope,
): Nullable<SignedTransaction>[] => {
    const { signedData } = result
    if (signedData.type === 'signed-transactions') {
        return Array.from(signedData.signed, signed => signed ?? null)
    }
    if (signedData.type === 'transactions') {
        return Array.from(signedData.signed, signed =>
            signed ? toSignedAlgorandTransaction(signed, scope) : null,
        )
    }
    throw new TransportError(
        `A ${signedData.type} result carries no signed transactions`,
    )
}
