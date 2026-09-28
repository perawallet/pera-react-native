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

// Every amount in this file is in base units. A summary is built synchronously
// and can't fetch decimals for a dApp-supplied transaction, so conversion to
// display units happens at the UI or persistence edge, using AssetMetadata.decimals.

import type { Decimal } from 'decimal.js'
import type { ChainId, ChainScope, NetworkId } from './identity'

/** An i18n key plus its interpolation params, resolved by the UI. */
export type LocalizedText = { key: string; params?: Record<string, string> }

export interface AssetRef {
    chainId: ChainId
    /** Chain-native id; the native asset has one too (e.g. `'0'` on Algorand). */
    assetId: string
}

// Persisted as a storage key. ChainId never contains `/`, so splitting at the
// first `/` is unambiguous even when an assetId contains one.
export const assetRefKey = (ref: AssetRef): string =>
    `${ref.chainId}/${ref.assetId}`

// TODO: take ChainDescriptor once it exists
export const isNativeAsset = (
    ref: AssetRef,
    descriptor: { id: ChainId; nativeAsset: { assetId: string } },
): boolean =>
    ref.chainId === descriptor.id &&
    ref.assetId === descriptor.nativeAsset.assetId

export type SigningScheme = 'ed25519' | 'falcon-1024'

export type AccountChainState = {
    family: 'algorand'
    authAddress?: string
    /** microAlgos. */
    minBalance: Decimal
    status: 'Offline' | 'Online' | 'NotParticipating'
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
}

export interface AccountState {
    address: string
    scope: ChainScope
    nativeBalance: Decimal
    chainState: AccountChainState
}

export interface Holding {
    assetRef: AssetRef
    amount: Decimal
}

export interface AssetMetadata {
    assetRef: AssetRef
    decimals: number
    name?: string
    symbol?: string
    logoUrl?: string
}

export interface AssetPrice {
    assetRef: AssetRef
    /** USD per whole (display) unit. */
    usdPrice: Decimal
}

export type TransactionIconKind =
    | 'send'
    | 'receive'
    | 'self'
    | 'swap'
    | 'contract-call'
    | 'approval'
    | 'opt-in'
    | 'unknown'

export interface TransactionSummary {
    kind:
        | 'transfer'
        | 'token-transfer'
        | 'nft-transfer'
        | 'contract-call'
        | 'approval'
        | 'swap'
        | 'chain-specific'
    title: LocalizedText
    direction: 'in' | 'out' | 'self' | 'none'
    counterparty?: string
    amount?: { assetRef: AssetRef; value: Decimal }
    icon: TransactionIconKind
}

export type ChainTransactionData = {
    family: 'algorand'
    /** Base64. */
    groupId?: string
    rekeyTo?: string
    closeRemainderTo?: string
}

export interface UnsignedTransaction {
    scope: ChainScope
    /** Chain-native transaction; only the owning adapter reads it. */
    payload: unknown
    summary: TransactionSummary
    chainData: ChainTransactionData
}

export interface TransactionRecord {
    /** Chain-native transaction id, never a round or block number. */
    id: string
    scope: ChainScope
    status: 'pending' | 'confirmed' | 'failed' | 'replaced'
    /** Unix ms. */
    timestamp?: number
    /** In the native asset. */
    fee?: Decimal
    summary: TransactionSummary
    chainData: ChainTransactionData
}

export type TransactionIntent = {
    kind: 'transfer'
    from: string
    to: string
    assetRef: AssetRef
    amount: Decimal
    note?: string
}

export interface BuildContext {
    scope: ChainScope
    chainState?: AccountChainState
}

export interface FeeEstimate {
    assetRef: AssetRef
    amount: Decimal
}

/** Opaque; only the adapter that issued it can interpret it. */
export type SyncCursor = string

export interface PageRef {
    cursor: string
    limit?: number
}

export interface Page<T> {
    items: T[]
    next?: PageRef
}

export interface SigningRequest {
    requestIndex: number
    signer: string
    scheme: SigningScheme
    /** Final bytes to sign: any hashing or domain prefix is already applied, and the key store adds none. */
    payload: Uint8Array
}

export interface Signature {
    requestIndex: number
    signer: string
    scheme: SigningScheme
    bytes: Uint8Array
}

export interface SignedTransaction {
    scope: ChainScope
    id: string
    bytes: Uint8Array
}

export interface TransactionReceipt {
    id: string
    scope: ChainScope
    status: 'confirmed' | 'failed'
    /** Unix ms. */
    confirmedAt?: number
}

export interface DeriveOpts {
    scheme: SigningScheme
    /** Address encoding can differ per network (e.g. a bech32 testnet prefix). */
    networkId: NetworkId
}

export interface PaymentUriOpts {
    assetRef?: AssetRef
    amount?: Decimal
    label?: string
    note?: string
}

export interface MessageSummary {
    kind: 'text' | 'typed-data' | 'raw'
    title: LocalizedText
    preview?: string
}

export interface MessageRequest {
    scope: ChainScope
    signer: string
    payload: unknown
    summary: MessageSummary
}

export interface SignedMessage {
    scope: ChainScope
    signature: Signature
}
