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

import { type Decimal } from 'decimal.js'

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { MinimalAsset } from '@perawallet/wallet-core-assets'

export type SwapsState = BaseStoreState & {
    fromAsset: string
    toAsset: string
    slippage: Nullable<string>
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string) => void
    setSlippage: (slippage: Nullable<string>) => void
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
    id: number
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
    id?: number
    quoteIdStr?: string
    provider?: SwapProvider
    providerDisplayName?: string
    swapType?: SwapType
    swapperAddress?: string
    device?: Nullable<number>
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
