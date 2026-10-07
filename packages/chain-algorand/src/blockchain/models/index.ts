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
    PeraSignedTransaction,
    PeraSignedTransactionGroup,
    PeraTransactionGroup,
} from '@perawallet/wallet-core-chain-contract'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { PQSchemeId } from '@perawallet/wallet-core-kms'

export const MAX_TX_NOTE_BYTES = 1024

export type BlockchainStore = BaseStoreState

export { Address } from 'algosdk'

/**
 * A post-quantum signature together with the material needed to verify it.
 *
 * Scheme-agnostic by construction: `schemeId` selects the wire scheme, so a
 * second PQ scheme needs no new type. The address salt is derived from
 * (scheme, publicKey) and is therefore not carried here.
 */
export type PQSignature = {
    schemeId: PQSchemeId
    publicKey: Uint8Array
    signature: Uint8Array
}

/**
 * Drops the `null` padding slots a signing result may carry (the ARC-0001
 * slot-order contract pads unsignable positions with `null`).
 */
export const compactSignedResults = (
    signed: Nullable<PeraSignedTransaction>[],
): PeraSignedTransaction[] =>
    signed.filter((tx): tx is PeraSignedTransaction => tx !== null)

export type PeraTransactionSigner = (
    txnGroup: PeraTransactionGroup,
    indexesToSign: number[],
) => Promise<PeraSignedTransactionGroup>

export type PeraEncodedTransactionSigner = (
    txnGroup: PeraTransactionGroup,
    indexesToSign: number[],
) => Promise<Uint8Array[]>
