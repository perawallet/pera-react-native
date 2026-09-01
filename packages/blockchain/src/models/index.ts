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
import { type BaseStoreState } from '@perawallet/wallet-core-shared'
import { type Address } from 'algosdk'

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
 * Byte carrier for a quantum (post-quantum, Falcon-1024) signed transaction.
 *
 * Seam B (`packages/blockchain/src/pq/quantumAdapter.ts`) assembles pqsig
 * transactions via the joe-p algosdk fork, which is the only module
 * allowed to decode/encode that fork's `SignedTransaction` shape (the
 * firewall in `pq/__tests__/pqLibraryFirewall.spec.ts` enforces this). To
 * avoid leaking the fork's types outside Seam B, the adapter instead returns
 * already-encoded, node-ready msgpack bytes, carried here alongside the
 * plain (fork-agnostic) `PeraTransaction` for display/bookkeeping.
 */
export type QuantumSignedTransaction = {
    txn: PeraTransaction
    /** Already-encoded, node-ready msgpack bytes (see Seam B). */
    pqSignedBytes: Uint8Array
}

/** Result of signing: either a normal algosdk `SignedTransaction`, or the quantum byte carrier. */
export type PeraSignedTxnResult =
    | PeraSignedTransaction
    | QuantumSignedTransaction

export const isQuantumSignedTransaction = (
    t: PeraSignedTxnResult,
): t is QuantumSignedTransaction =>
    (t as QuantumSignedTransaction).pqSignedBytes instanceof Uint8Array

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
