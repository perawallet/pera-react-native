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
import type { ChainDescriptor } from './descriptor'
import type { I18nKey } from './i18n'
import type { ChainFamily, ChainId, ChainScope, NetworkId } from './identity'

/** An i18n key plus its interpolation params, resolved by the UI. */
export type LocalizedText = { key: I18nKey; params?: Record<string, string> }

export interface AssetRef {
    chainId: ChainId
    /** Chain-native id; the native asset has one too (e.g. `'0'` on Algorand). */
    assetId: string
}

// Persisted as a storage key. ChainId never contains `/`, so splitting at the
// first `/` is unambiguous even when an assetId contains one.
export const assetRefKey = (ref: AssetRef): string =>
    `${ref.chainId}/${ref.assetId}`

export const isNativeAsset = (
    ref: AssetRef,
    descriptor: Pick<ChainDescriptor, 'id' | 'nativeAsset'>,
): boolean =>
    ref.chainId === descriptor.id &&
    ref.assetId === descriptor.nativeAsset.ref.assetId

export type SigningScheme = 'ed25519' | 'falcon-1024' | 'secp256k1'

export const isPostQuantumScheme = (scheme: SigningScheme): boolean =>
    scheme === 'falcon-1024'

/**
 * Account data only its own chain reads, persisted on the account's chain
 * entry. A chain package adds its member, discriminated by `family`.
 */
export type ChainAccountNative = {
    family: 'algorand'
    /** Present on a multisig account; Algorand derives the address from it. */
    multisig?: { version: number; threshold: number; addresses: string[] }
    /**
     * Present on a post-quantum account; `publicKey` is base64. Kept on the
     * record because a realm that can't open the keystore (the extension's
     * offscreen document) still has to describe the account's signature.
     */
    pq?: { scheme: Extract<SigningScheme, 'falcon-1024'>; publicKey: string }
}

/**
 * Holding data only its own chain reads, persisted on the holding row. A chain
 * package adds its member, discriminated by `family`.
 */
export type ChainHoldingNative = {
    family: 'algorand'
    isFrozen: boolean
}

/**
 * Asset data only its own chain reads, persisted on the asset's node row. A
 * chain package adds its member, discriminated by `family`.
 */
export type ChainAssetData = {
    family: 'algorand'
    creatorAddress: string
}

/**
 * Attempt data only its own chain reads, persisted on the submission attempt.
 * A chain package adds its member, discriminated by `family`. Record it only
 * when the chain's reconciler can settle the attempt by it: an attempt carrying
 * it never ages out of the ledger's guards.
 */
export type ChainSubmissionData = {
    family: 'algorand'
    /** A last-valid round of the group; the group can't land after any member's. */
    lastValid: number
}

export type AccountChainState =
    | {
          family: 'algorand'
          authAddress?: string
          /** microAlgos. */
          minBalance: Decimal
          status: 'Offline' | 'Online' | 'NotParticipating'
          totalAssetsOptedIn: number
          totalCreatedAssets: number
          totalAppsOptedIn: number
      }
    | {
          family: 'evm'
          /** Transaction count; `pending` includes transactions still in the mempool. */
          nonce: { latest: number; pending: number }
      }

export interface AccountState {
    address: string
    scope: ChainScope
    /** Display units of the native asset. */
    nativeBalance: Decimal
    /**
     * Base units of the native asset (microAlgos on Algorand), unlike
     * `nativeBalance`: what the chain holds back from spending (Algorand's
     * minimum balance); zero on a chain with no reserve.
     */
    reserveBalance: Decimal
    /** Non-native assets the account holds or has opted in to. */
    heldTokenCount: number
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
    | 'opt-out'
    | 'asset-config'
    | 'asset-freeze'
    /** Participation records. */
    | 'consensus'
    | 'unknown'

/**
 * The source's own facts for an asset it reports, so an amount still renders
 * when the asset store doesn't hold that asset. The store's facts win when it does.
 */
export interface AssetDisplayHint {
    symbol: string
    decimals: number
}

export interface BalanceChange {
    assetRef: AssetRef
    /** Signed base units: negative left the account, positive arrived. */
    value: Decimal
    display?: AssetDisplayHint
}

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
    /** Shown instead of the counterparty's name when set. */
    subtitle?: LocalizedText
    /** Unsigned: the sign comes from `direction`. `balanceChanges` carry their own sign. */
    amount?: { assetRef: AssetRef; value: Decimal; display?: AssetDisplayHint }
    /** Shown instead of `amount` when set. */
    balanceChanges?: BalanceChange[]
    icon: TransactionIconKind
    /** Absent on a confirmed transaction with nothing chain-specific to flag. */
    notice?: TransactionNotice
}

/** A chain-specific state the row and detail must flag, such as pending, failed or replaced. */
export interface TransactionNotice {
    kind: 'warning' | 'error'
    title: LocalizedText
    /** Unix ms. The UI formats it into the title's `since` param. */
    since?: number
}

export type ChainTransactionData =
    | {
          family: 'algorand'
          /** Base64. */
          groupId?: string
          rekeyTo?: string
          closeRemainderTo?: string
      }
    | { family: 'evm' }

/** Payment-link fields only the parsing chain reads; each family adds a member discriminated by `family`. */
export type ChainPaymentData = {
    family: 'algorand'
    /** The ARC-26 note the user cannot edit. */
    xnote?: string
}

/**
 * A link action only its own chain can build; each family adds a member
 * discriminated by `family`. Algorand keys are base64 or base64url, padded or
 * not, as the link spells them; rounds and dilution are decimal digits; `fee`
 * is microAlgos.
 */
export type ChainActionData = {
    family: 'algorand'
    action: 'keyreg'
    sender: string
    keyregType: 'online' | 'offline'
    voteKey?: string
    selectionKey?: string
    stateProofKey?: string
    voteFirst?: string
    voteLast?: string
    voteKeyDilution?: string
    fee?: Decimal
    note?: string
    xnote?: string
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
    /**
     * The address that signed the transaction; absent when the history doesn't
     * say. A `direction: 'out'` summary alone doesn't prove the account sent it.
     */
    initiator?: string
    summary: TransactionSummary
    chainData: ChainTransactionData
}

/**
 * A transaction as its own chain's review and detail UI reads it. Only the
 * chain named by `family` reads `transaction`, the way only the owning
 * adapter reads `UnsignedTransaction.payload`.
 */
export interface TransactionNative {
    family: ChainFamily
    transaction: unknown
}

export type TransferIntent = {
    kind: 'transfer'
    from: string
    to: string
    assetRef: AssetRef
    /** Base units. */
    amount: Decimal
    note?: string
}

/** Only built by a chain whose accounts must opt in before they can hold an asset. */
export type AssetOptInIntent = {
    kind: 'asset-opt-in'
    account: string
    assetRef: AssetRef
}

export type TransactionIntent = TransferIntent | AssetOptInIntent

export interface BuildContext {
    scope: ChainScope
    chainState?: AccountChainState
    /** The speed to price at; unset means `'normal'`. A chain without presets ignores it. */
    feePreset?: FeePreset
}

/** Slowest first, which is the display order. */
export const FEE_PRESETS = ['slow', 'normal', 'fast'] as const

export type FeePreset = (typeof FEE_PRESETS)[number]

/** Both amounts are in base units of the native asset. */
export interface FeePresetEstimate {
    /** The expected cost. */
    amount: Decimal
    /** The most the transaction can be charged; the sender's balance must cover it on top of what it sends. */
    maxAmount: Decimal
    /** Expected seconds until the transaction lands at this preset; a whole number, at least 1. */
    estimatedWaitSeconds: number
}

export interface FeeEstimate {
    assetRef: AssetRef
    /** In base units of `assetRef`. With `presets` set, equals `presets[context.feePreset ?? 'normal'].amount`. */
    amount: Decimal
    /** Set by a chain whose `protocol.feeModel` is `'gas'`. */
    presets?: Record<FeePreset, FeePresetEstimate>
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
    /**
     * What a hardware signer takes when it hashes on-device: Algorand's
     * prefix-free msgpack transaction, Ethereum's EIP-2718 unsigned
     * serialization. Only devices read it; the key store signs `payload`.
     * Every transaction planner sets it; a request without one can't be
     * signed on a device.
     */
    devicePayload?: Uint8Array
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
    /** Whole base units of the asset (microAlgos for ALGO). */
    amount?: Decimal
    label?: string
    note?: string
    /** Unset in a parsed URI that names no network; the current network applies. A chain whose URIs carry no network ignores it. */
    networkId?: NetworkId
}

/** Field names and values come from the requester and are never translated. */
export type MessageTreeNode =
    | { label: string; value: string }
    | { label: string; children: MessageTreeNode[] }

export interface SpendAllowance {
    assetRef: AssetRef
    /** Base units of assetRef; absent when unlimited. */
    amount?: Decimal
    /** Set when the allowance is one non-fungible token; `collection` is its contract in the chain's address format, `tokenId` a decimal string. */
    nft?: { collection: string; tokenId: string }
}

export interface SpendApproval {
    /** Requester-supplied, in the chain's address format. */
    spender: string
    /** One per asset, in message order; never empty. */
    allowances: SpendAllowance[]
    /** Unix ms after which the approval can't be used; absent when it never lapses. */
    deadline?: number
    /** deadline is absent or more than a year after the summary was built. */
    isLongLived: boolean
}

export interface MessageSummary {
    kind: 'text' | 'typed-data' | 'raw'
    title: LocalizedText
    preview?: string
    /** Set for kind `'typed-data'`: the signed fields, in schema order. */
    tree?: MessageTreeNode[]
    /** Set on kind `'typed-data'` when signing lets someone else move the signer's assets. */
    spendApproval?: SpendApproval
}

export interface MessageRequest {
    scope: ChainScope
    /** The kind of signature asked for; a chain's message signer lists the methods it signs. */
    method: string
    signer: string
    /** Chain-native; only the owning adapter reads it. */
    payload: unknown
}

export interface SignedMessage {
    scope: ChainScope
    signature: Signature
}
