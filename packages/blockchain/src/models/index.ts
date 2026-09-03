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

import type { SignedTransaction, Transaction, indexerModels } from 'algosdk'
import {
    type BaseStoreState,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { type Address } from 'algosdk'
import type { PQSchemeId } from '../pq/schemes'

type IndexerTransaction = indexerModels.Transaction

export const MAX_TX_NOTE_BYTES = 1024

export type BlockchainStore = BaseStoreState

export { Address } from 'algosdk'

// algosdk's indexer models are classes implementing Encodable (each carries
// `getEncodingSchema`/`toEncodingData` methods). The displayable transaction is
// built as a plain object, so strip method-valued properties recursively to get
// a structural, literal-assignable shape while keeping every data field.
type PlainModel<T> = T extends Uint8Array
    ? T
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      T extends (...args: any[]) => any
      ? never
      : T extends (infer U)[]
        ? PlainModel<U>[]
        : T extends object
          ? {
                [
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    K in keyof T as T[K] extends (...args: any[]) => any
                        ? never
                        : K
                ]: PlainModel<T[K]>
            }
          : T

export type PeraDisplayableTransaction = PlainModel<IndexerTransaction> & {
    roundTimeMillis?: number
    rawTransaction?: PeraTransaction
    /**
     * Count of inner transactions when only the local summary is available
     * (mapped from the SQLite history row). Indexer-fetched transactions
     * carry the full `innerTxns` array instead; prefer it when present.
     */
    innerTransactionCount?: number
}

export type AccountInformation = {
    /** Minimum balance in microAlgos (base units, bigint) */
    minBalance: bigint
    /** Account balance in microAlgos (base units, bigint) */
    amount: bigint
    address: Address
    status: string
    /** Pending rewards in microAlgos (base units, bigint) */
    rewards: bigint
    /** Opted-in assets with amounts in base units (smallest indivisible unit) */
    assets: Array<{ assetId: bigint; amount: bigint; isFrozen: boolean }>
    /** Auth (signer) address when the account is rekeyed; undefined otherwise */
    authAddress?: string
}

export type PeraTransaction = Transaction

export type PeraTransactionGroup = PeraTransaction[]

export type PeraSignedTransaction = SignedTransaction

export type PeraSignedTransactionGroup = PeraSignedTransaction[]

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

export type PeraTransactionType =
    | 'payment'
    | 'asset-transfer'
    | 'asset-opt-in'
    | 'asset-opt-out'
    | 'asset-clawback'
    | 'asset-config'
    | 'asset-freeze'
    | 'key-registration'
    | 'app-call'
    | 'state-proof'
    | 'heartbeat'
    | 'unknown'

export type PeraTransactionSigner = (
    txnGroup: PeraTransactionGroup,
    indexesToSign: number[],
) => Promise<PeraSignedTransactionGroup>

export type PeraEncodedTransactionSigner = (
    txnGroup: PeraTransactionGroup,
    indexesToSign: number[],
) => Promise<Uint8Array[]>

export type KeyRegType = 'online' | 'offline'

export type AssetTransferType =
    | 'transfer'
    | 'opt-in'
    | 'opt-out'
    | 'clawback'
    | 'unknown'

export type AssetConfigType = 'create' | 'update' | 'destroy'
