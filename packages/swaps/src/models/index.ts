/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { BaseStoreState } from '@perawallet/wallet-core-shared'

export type SwapsState = BaseStoreState & {
    fromAsset: string
    toAsset: string
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string) => void
}

export type SwapProvider =
    | 'tinyman'
    | 'tinyman-v2'
    | 'tinyman-swap-router'
    | 'vestige-v3'
    | 'vestige-v4'
    | 'folks-router'
    | 'deflex'
    | 'xo'
    | 'meld'

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

export interface DexSwapAsset {
    assetId: number
    logo?: string
    name?: string
    unitName?: string
    total?: string
    decimals?: number
    verificationTier: string
    usdValue?: string | null
}

export interface SwapHistoryItem {
    id: number
    idStr?: string
    provider: SwapProvider
    status: SwapStatus
    completedDatetime: string | null
    transactionGroupId: string | null
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    amountIn: string
    amountOut: string
    amountInUsdValue: string | null
    amountOutUsdValue: string | null
}

export interface SwapDistinctPairItem {
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    swapDatetime: string
    pairKey: string
}

export interface SwapQuote {
    id?: number
    quoteIdStr?: string
    provider?: SwapProvider
    swapType?: SwapType
    swapperAddress?: string
    device?: number | null
    assetIn: DexSwapAsset
    assetOut: DexSwapAsset
    amountIn?: string
    amountInWithSlippage?: string
    amountInUsdValue?: string | null
    amountOut?: string
    amountOutWithSlippage?: string
    amountOutUsdValue?: string | null
    slippage?: string
    price?: string
    priceImpact?: string
    peraFeeAmount?: string
    exchangeFeeAmount?: string
    transactionFees?: string | null
}

export interface TransactionGroup {
    purpose?: TransactionGroupPurpose
    transactionGroupId?: string
    transactions?: string[]
    signedTransactions?: string[]
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
    peraFeeAmount?: number
    peraFeeAssetId?: number
}

export interface CalculateSwapAmountResult {
    amount?: string
    peraFee?: string
    peraFeeAssetId?: number
}

export interface PrepareTransactionsResult {
    transactionGroups?: TransactionGroup[]
    swapId?: number
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
