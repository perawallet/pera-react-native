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

import { type Decimal } from 'decimal.js'

import type {
    BaseStoreState,
    Network,
    Nullable,
} from '@perawallet/wallet-core-shared'
import type { MinimalAsset } from '@perawallet/wallet-core-assets'

export type SwapsState = BaseStoreState & {
    fromAsset: string
    toAsset: string
    slippage: Nullable<string>
    isLocalCurrencyInput: boolean
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string) => void
    setSlippage: (slippage: Nullable<string>) => void
    setIsLocalCurrencyInput: (value: boolean) => void
}

export type SwapConfigurationResult = {
    balancePercentage: Nullable<number>
    slippageTolerance: Nullable<string>
    useLocalCurrency: boolean
}

export type SwapProvider = string

export type SwapStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'cancelled'

export type SwapType = 'fixed-input' | 'fixed-output'

export type TransactionGroupPurpose = 'opt-in' | 'swap' | 'fee'

export type SwapReason =
    | 'other'
    | 'user_cancelled'
    | 'invalid_submission'
    | 'blockchain_error'

export type SwapVersion = 'v1' | 'v2'

export interface DexSwapAsset extends MinimalAsset {
    logo?: string
    total?: string
    verificationTier: string
    usdValue?: Nullable<string>
}

export interface SwapHistoryItem {
    /** Decimal string — backend ids exceed 2^53 and must not live in a JS number. */
    id: string
    idStr?: Nullable<string>
    provider: SwapProvider
    status: SwapStatus
    completedDatetime: Nullable<string>
    transactionGroupId: Nullable<string>
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    /** Amount of input asset swapped, in base units */
    amountIn: Decimal
    /** Amount of output asset received, in base units */
    amountOut: Decimal
    amountInUsdValue?: Nullable<string>
    amountOutUsdValue?: Nullable<string>
}

export interface SwapDistinctPairItem {
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    swapDatetime: string
    pairKey: string
}

export interface SwapQuote {
    /** Decimal string — backend ids exceed 2^53; quoteIdStr is canonical. */
    id?: string
    quoteIdStr?: string
    provider?: SwapProvider
    providerDisplayName?: string
    swapType?: SwapType
    swapperAddress?: string
    device?: Nullable<string>
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    /** Amount of input asset, in base units */
    amountIn?: Decimal
    /** Amount of input asset with slippage applied, in base units */
    amountInWithSlippage?: Decimal
    amountInUsdValue?: Nullable<string>
    /** Amount of output asset, in base units */
    amountOut?: Decimal
    /** Amount of output asset with slippage applied, in base units */
    amountOutWithSlippage?: Decimal
    amountOutUsdValue?: Nullable<string>
    slippage?: Decimal
    price?: Decimal
    priceImpact?: Decimal
    peraFeeAmount?: Decimal
    peraFeeAsset?: DexSwapAsset
    transactionFees?: Nullable<Decimal>
    /**
     * Epoch ms when the quote was received (client-stamped in the
     * transformer). Quotes older than `SWAP_QUOTE_TTL_MS` are refused at
     * confirm time — see `isQuoteFresh`.
     */
    fetchedAt?: number
}

export interface TransactionGroup {
    purpose?: TransactionGroupPurpose
    transactionGroupId?: string
    transactions?: Nullable<string>[]
    signedTransactions?: Nullable<string>[]
}

export interface SwapProviderItem {
    name: SwapProvider
    displayName: string
    iconUrl: string
}

export interface TopPairItem {
    assetA: DexSwapAsset
    assetB: DexSwapAsset
    volume24hUsd: string
}

export interface CalculatePeraFeeResult {
    peraFeeAmount?: Decimal
    /** Asset id as a decimal string — uint64 ids must never live in a JS number. */
    peraFeeAssetId?: string
}

export interface CalculateSwapAmountResult {
    amount?: Decimal
    peraFee?: Decimal
    /** Asset id as a decimal string — uint64 ids must never live in a JS number. */
    peraFeeAssetId?: string
}

export interface PrepareTransactionsResult {
    transactionGroups?: TransactionGroup[]
    /** Decimal string — backend ids exceed 2^53; swapIdStr is canonical. */
    swapId?: string
    swapIdStr?: string
    swapVersion?: string
}

export interface SwapStatusUpdateResult {
    status: SwapStatus
    submittedTransactionIds?: string[]
    reason?: SwapReason
    appVersion?: string
    platform?: string
    countryCode?: string
    swapVersion?: SwapVersion
}

/**
 * A single slot in a group's submission order, serialized for persistence.
 * Mirrors the app-side `GroupSlot` but with the pre-signed transaction stored
 * as base64 (no `Uint8Array`/`PeraSignedTransaction` in persisted state).
 */
export type SerializedGroupSlot =
    | { kind: 'preSigned'; signedTxnBase64: string }
    | { kind: 'toSign'; flatIndex: number }

/** One atomic group's submission plan, serialized for persistence. */
export interface SerializedGroupPlan {
    slots: SerializedGroupSlot[]
}

/**
 * A shared-account swap waiting on co-signer signatures. Persisted by the
 * proposer's device so the swap can be completed in real time while the app
 * is foregrounded, or rehydrated and finished on next launch if the co-signer
 * signed while the app was closed. Holds only serializable data — the resolver
 * reconstructs the algod client / encoders / API callbacks each session.
 */
export interface SwapHandoffRecord {
    /** Canonical swap id (decimal string — backend ids exceed 2^53). */
    swapIdStr: string
    /** Backend multisig sign-request id this swap is waiting on. */
    signRequestId: string
    /** Network the sign request lives on. */
    network: Network
    /** The shared (multisig) account proposing the swap. */
    multisigAddress: string
    /** Persistent device id for the `with-signatures` + `mark-confirmed` calls. */
    deviceId: string
    /** Canonical multisig metadata for composite-signature assembly. */
    msigMetadata: { version: number; threshold: number; addresses: string[] }
    /**
     * Per-group submission plan. Pre-signed slots carry their base64 signed
     * bytes; to-sign slots index into the flat assembled-signature order the
     * resolver produces from the backend's collected signatures.
     */
    plan: SerializedGroupPlan[]
    /**
     * Base64 raw (unsigned) transactions the proposer signed and sent to the
     * backend — the trust anchor. The resolver refuses to submit if the poll's
     * raw transactions differ from these (the proposer never reviewed them).
     */
    expectedRawTransactionsBase64: string[]
    /** Epoch ms when registered; used for ordering / staleness only. */
    registeredAt: number
    /**
     * Set (durably) the moment algod accepts the group(s), before any other
     * post-submit side effect. Its presence means the swap is on chain: a
     * relaunch after a crash must replay the post-submit tail instead of
     * re-submitting — algod would reject the duplicate and the landed swap
     * would be flipped to "failed".
     */
    submission?: { txIds: string[]; submittedAt: number }
}

export type SwapHandoffState = BaseStoreState & {
    /** Pending shared-account swap handoffs, keyed by signRequestId. */
    handoffs: Record<string, SwapHandoffRecord>
    registerHandoff: (record: SwapHandoffRecord) => void
    markHandoffSubmitted: (signRequestId: string, txIds: string[]) => void
    removeHandoff: (signRequestId: string) => void
}
