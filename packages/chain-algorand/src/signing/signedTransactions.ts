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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    PeraSignedTransaction,
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    TransportError,
    type LocalKeySigningDeps,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import {
    decodeSignedTransaction,
    encodeSignedTransaction,
    encodeTransactionRaw,
} from '../blockchain/utils/transact'
import { algorandTransactionsOf } from './algorandRequest'
import {
    assembleSignedTransaction,
    signTransactionsWithLocalKey,
} from './local-key/signTransactionsWithLocalKey'

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

export const assembleSignedAlgorandTransaction = (
    unsigned: UnsignedTransaction,
    signature?: { sig: Uint8Array; signerAddress: string },
): SignedTransaction =>
    toSignedAlgorandTransaction(
        assembleSignedTransaction(
            algorandTransactionsOf([unsigned])[0],
            signature,
        ),
        unsigned.scope,
    )

export const signUnsignedTransactionsWithLocalKey = async (
    deps: LocalKeySigningDeps,
    transactions: UnsignedTransaction[],
    indexesToSign: number[],
    account: WalletAccount,
): Promise<SignedTransaction[]> => {
    const signed = await signTransactionsWithLocalKey(
        deps,
        algorandTransactionsOf(transactions),
        indexesToSign,
        account,
    )
    return signed.map((transaction, index) =>
        toSignedAlgorandTransaction(transaction, transactions[index].scope),
    )
}

/** Without the signing-domain prefix: what a Ledger signs and the multisig backend stores. */
export const unsignedAlgorandTransactionBytesOf = (
    signed: SignedTransaction,
): Uint8Array => encodeTransactionRaw(decodeSignedTransaction(signed.bytes).txn)

export const algorandSignedTransactionsOf = (
    result: SigningResult,
    _scope: ChainScope,
): Nullable<SignedTransaction>[] => {
    const { signedData } = result
    if (
        signedData.type === 'signed-transactions' ||
        signedData.type === 'transactions'
    ) {
        return Array.from(signedData.signed, signed => signed ?? null)
    }
    throw new TransportError(
        `A ${signedData.type} result carries no signed transactions`,
    )
}
