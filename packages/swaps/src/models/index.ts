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

import type { Decimal } from 'decimal.js'

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { AssetGroup, MinimalAsset } from '@perawallet/wallet-core-assets'
import type {
    AssetRef,
    ChainId,
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'

export type SwapsState = BaseStoreState & {
    /** null until the user picks one: the chain's native asset. */
    fromAsset: Nullable<string>
    /** null until the user picks one: the chain adapter's default receive asset. */
    toAsset: Nullable<string>
    /** Where `toAsset` lives; null means the swap scope. */
    toAssetScope: Nullable<ChainScope>
    /** The account receiving a cross-chain swap; null picks the default. */
    receivingAccountId: Nullable<string>
    /** The chain the user chose to pay from; null picks the default. */
    sourceChainId: Nullable<ChainId>
    slippage: Nullable<string>
    isLocalCurrencyInput: boolean
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string, toAssetScope?: Nullable<ChainScope>) => void
    setReceivingAccountId: (id: Nullable<string>) => void
    /** Clears the pair and the receiving account: they belong to the old chain. */
    setSourceChainId: (chainId: Nullable<ChainId>) => void
    /** Pays with `fromAsset` on `chainId`; clears the receive side and receiving account: they belong to the old chain. */
    setSourceAsset: (chainId: ChainId, fromAsset: string) => void
    setSlippage: (slippage: Nullable<string>) => void
    setIsLocalCurrencyInput: (value: boolean) => void
}

export type SwapConfigurationResult = {
    balancePercentage: Nullable<number>
    slippageTolerance: Nullable<string>
    useLocalCurrency: boolean
}

/** The router's id for whoever fills the offer, passed through unread. */
export type SwapProvider = string

export type SwapStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'expired'
    | 'refunded'

/** An asset on one chain network; `assetId` is the chain's own id for it. */
export interface SwapAssetRef extends AssetRef {
    networkId: NetworkId
}

/** `assetId` always equals `ref.assetId`. */
export interface SwapAsset extends MinimalAsset {
    ref: SwapAssetRef
    logo?: string
    verificationTier: string
    crossChainAssetGroup: Nullable<AssetGroup>
}

export type SwapRouteKind = 'single-chain' | 'cross-chain'

export type SwapFeeKind = 'pera' | 'network' | 'provider'

export interface SwapFee {
    kind: SwapFeeKind
    asset: SwapAssetRef
    /** Base units of `asset`. */
    amount: Decimal
    usdValue: Nullable<string>
}

/** What the app asked the router for; the trust anchor for validating what comes back. */
export interface SwapQuoteRequest {
    sourceAsset: SwapAssetRef
    destinationAsset: SwapAssetRef
    /** Base units of `sourceAsset`. */
    sourceAmount: Decimal
    sourceAddress: string
    destinationAddress: string
    /** Percent, e.g. "0.5"; null leaves the router's default. */
    slippage: Nullable<string>
}

export interface SwapQuote {
    quoteId: string
    request: SwapQuoteRequest
    provider: SwapProvider
    routeKind: SwapRouteKind
    assetIn: SwapAsset
    assetOut: SwapAsset
    /** Base units of `assetIn`. */
    amountIn: Decimal
    /** Base units of `assetOut`, already net of every fee. */
    amountOut: Decimal
    /** Base units of `assetOut`; null when the route sets no minimum. */
    minimumAmountOut: Nullable<Decimal>
    amountInUsdValue: Nullable<string>
    amountOutUsdValue: Nullable<string>
    fees: SwapFee[]
    /** Percent. */
    priceImpact: Nullable<Decimal>
    /** Epoch ms; null when the router gives no expiry. */
    expiresAt: Nullable<number>
    /** Epoch ms, client-stamped: the reference point for `isQuoteFresh`. */
    fetchedAt: number
    /** The source-chain address the source leg must pay; null when the router names none. */
    depositAddress: Nullable<string>
}

export type SwapSignTransactionsStep = {
    kind: 'sign-transactions'
    scope: ChainScope
    /** The router's label for the step, echoed back when reporting it. */
    purpose: string
    /** In the chain's own wire encoding. */
    transactions: string[]
    /**
     * Positional with `transactions`: null where the wallet signs, the signed
     * transaction where the provider already did. Null when nothing is.
     */
    presignedTransactions: Nullable<Nullable<string>[]>
}

export type SwapOrderStep =
    | SwapSignTransactionsStep
    | { kind: 'unsupported'; routerKind: string }

export interface SwapOrder {
    orderId: string
    status: SwapStatus
    /** Epoch ms; null when the order never expires. */
    expiresAt: Nullable<number>
    steps: SwapOrderStep[]
}

export interface SwapReportedTransaction {
    scope: ChainScope
    txHash: string
    /** The `purpose` of the step the transaction came from. */
    purpose: string
}

export type SwapOrderReport =
    | { status: 'sent'; transactions: SwapReportedTransaction[] }
    | { status: 'cancelled' }

export interface SwapOrderTransaction {
    /** Null when the router names a chain this wallet doesn't run. */
    scope: Nullable<ChainScope>
    txHash: string
    role: string
}

/** Rows written before the router carry nulls for whatever they lack. */
export interface SwapHistoryItem {
    orderId: string
    provider: Nullable<SwapProvider>
    status: SwapStatus
    assetIn: Nullable<SwapAsset>
    assetOut: Nullable<SwapAsset>
    /** Base units of `assetIn`. */
    amountIn: Nullable<Decimal>
    /** Base units of `assetOut`. */
    amountOut: Nullable<Decimal>
    amountInUsdValue: Nullable<string>
    amountOutUsdValue: Nullable<string>
    transactions: SwapOrderTransaction[]
    /** The router's `funding_method`, passed through unread. */
    fundingMethod: Nullable<string>
    createdAt: string
    updatedAt: string
}

export interface SwapAccountAddress {
    scope: ChainScope
    address: string
}

export interface SwapTrackedAsset {
    ref: SwapAssetRef
    unitName: Nullable<string>
}

/** Holds no amounts: those come from the live order. */
export interface SwapTrackedOrder {
    orderId: string
    sourceScope: ChainScope
    destinationScope: ChainScope
    sourceAddress: string
    destinationAddress: string
    assetIn: SwapTrackedAsset
    assetOut: SwapTrackedAsset
    status: SwapStatus
    /** Epoch ms. */
    createdAt: number
    /** Epoch ms of the last status change. */
    checkedAt: number
}

export type SwapTrackingState = BaseStoreState & {
    orders: Record<string, SwapTrackedOrder>
    trackOrder: (order: SwapTrackedOrder) => void
    updateOrderStatus: (
        orderId: string,
        status: SwapStatus,
        checkedAt: number,
    ) => void
    removeOrder: (orderId: string) => void
    pruneSettledOrders: (now: number) => void
}

export interface SwapDistinctPairItem {
    assetIn: SwapAsset
    assetOut: SwapAsset
    swapDatetime: string
    pairKey: string
}

/**
 * A single slot in a group's submission order, serialized for persistence.
 * Mirrors the app-side `GroupSlot` but with the pre-signed transaction stored
 * as base64 (no `Uint8Array` or signed-transaction object in persisted state).
 */
export type SerializedGroupSlot =
    | { kind: 'preSigned'; signedTxnBase64: string }
    | { kind: 'toSign'; flatIndex: number }

/** One atomic group's submission plan, serialized for persistence. */
export interface SerializedGroupPlan {
    slots: SerializedGroupSlot[]
    /** The router step's label, echoed back when reporting; absent on records from before the router. */
    purpose?: string
}

/**
 * A shared-account swap waiting on co-signer signatures. Persisted by the
 * proposer's device so the swap can be completed in real time while the app
 * is foregrounded, or rehydrated and finished on next launch if the co-signer
 * signed while the app was closed. Holds only serializable data — the resolver
 * reconstructs the algod client / encoders / API callbacks each session.
 */
export interface SwapHandoffRecord {
    /** The router order id (older records hold a pre-router swap id). */
    swapIdStr: string
    /** Backend multisig sign-request id this swap is waiting on. */
    signRequestId: string
    /** Scope the sign request lives on. */
    scope: ChainScope
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
