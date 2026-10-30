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

import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type AlgorandTransactionKind =
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

export type KeyRegType = 'online' | 'offline'

export type AssetTransferType =
    | 'transfer'
    | 'opt-in'
    | 'opt-out'
    | 'clawback'
    | 'unknown'

export type AssetConfigType = 'create' | 'update' | 'destroy'

// Field types are copied verbatim from the indexer shapes so a PeraDisplayableTransaction assigns to it.
export interface AlgorandTransactionView {
    id?: string
    txType?: string
    sender: string
    /** microAlgos. */
    fee: bigint
    note?: Uint8Array
    group?: Uint8Array
    confirmedRound?: bigint
    /** Unix ms. */
    roundTimeMillis?: number
    /** Raw public keys, while every other address here is a base32 string. */
    authAddr?: { readonly publicKey: Uint8Array }
    /** Raw public keys, while every other address here is a base32 string. */
    rekeyTo?: { readonly publicKey: Uint8Array }
    /** The chain-native unsigned transaction under review; only identity, truthiness and stringify are used. */
    rawTransaction?: unknown
    innerTxns?: AlgorandTransactionView[]
    /** Set when only the local history row is available; `innerTxns` wins when present. */
    innerTransactionCount?: number
    paymentTransaction?: {
        amount: bigint
        receiver: string
        closeAmount?: bigint
        closeRemainderTo?: string
    }
    assetTransferTransaction?: {
        amount: bigint
        assetId: bigint
        receiver: string
        closeAmount?: bigint
        closeTo?: string
        /** Clawback source. */
        sender?: string
    }
    assetConfigTransaction?: {
        assetId?: bigint
        params?: {
            decimals: number
            total: bigint
            defaultFrozen?: boolean
            manager?: string
            reserve?: string
            freeze?: string
            clawback?: string
            name?: string
            unitName?: string
            url?: string
            metadataHash?: Uint8Array
        }
    }
    assetFreezeTransaction?: {
        address: string
        assetId: bigint
        newFreezeStatus: boolean
    }
    keyregTransaction?: {
        nonParticipation?: boolean
        selectionParticipationKey?: Uint8Array
        stateProofKey?: Uint8Array
        voteFirstValid?: bigint
        voteKeyDilution?: bigint
        voteLastValid?: bigint
        voteParticipationKey?: Uint8Array
    }
    applicationTransaction?: {
        applicationId: bigint
        onCompletion?: string
        applicationArgs?: Uint8Array[]
        accounts?: { readonly publicKey: Uint8Array }[]
        foreignApps?: bigint[]
        foreignAssets?: bigint[]
        boxReferences?: { app: number; name: Uint8Array }[]
    }
    heartbeatTransaction?: {
        hbAddress: string
        hbKeyDilution: bigint
        hbVoteId: Uint8Array
    }
}

export const toAlgorandNative = (
    transaction: AlgorandTransactionView,
): TransactionNative => ({ family: 'algorand', transaction })

export const readAlgorandNative = (
    native: TransactionNative,
): Nullable<AlgorandTransactionView> =>
    // Sound only while toAlgorandNative is the one place an `algorand` member is built.
    native.family === 'algorand'
        ? (native.transaction as AlgorandTransactionView)
        : null
