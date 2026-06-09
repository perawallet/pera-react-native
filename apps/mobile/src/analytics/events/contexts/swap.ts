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

import type { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Swap flow. */
export enum SwapEvent {
    SelectTopAsset = 'swapscr_asset_top_select', // Selected the top (from) asset (asset name)
    SelectBottomAsset = 'swapscr_asset_bot_select', // Selected the bottom (to) asset (asset name)
    HistorySeeAll = 'swapscr_swap_history_see_all', // Tapped "see all" on swap history (opt. pairing)
    SelectHistory = 'swapscr_swap_history_select', // Picked a swap from history (opt. pairing)
    SelectHistoryInSeeAll = 'swapscr_swap_history_see_all_asset_select', // Picked a swap from the full history list (opt. pairing)
    SelectTopPair = 'swapscr_swap_top_select', // Selected a top trading pair (opt. pairing)
    SelectProviderOpen = 'swapscr_swap_select_provider', // Opened the provider selector (opt. router)
    SelectProviderRouter = 'swapscr_swap_select_provider_router', // Chose a specific router (opt. router)
    SettingsApply = 'swapscr_swap_settings_apply', // Applied swap settings
    SettingsLocalCurrencyOn = 'swapscr_swap_settings_local_currency_on', // Turned local-currency display on
    SettingsLocalCurrencyOff = 'swapscr_swap_settings_local_currency_off', // Turned local-currency display off
    Completed = 'swapscr_assets_completed', // A swap completed (full details: assets, amounts, fees)
    Failed = 'swapscr_assets_failed', // A swap failed (asset/amount details)
    Confirm = 'swapscr_assets_confirm', // Slid to confirm the swap
    ConfirmSwapButton = 'swapscr_assets_swap', // Tapped the Swap button
    EnterNumbers = 'swapscr_enter_amount_tap', // Started entering an amount
    SelectFromToken = 'swapscr_select_top_asset_tap', // Opened the from-token selector (asset id)
    SelectToToken = 'swapscr_select_lower_asset_tap', // Opened the to-token selector (asset id)
}

/**
 * Shared status metadata for completed / failed swaps. The `*AsUsd` and `*AsAlgo`
 * fields are optional: RN sources these from the swap quote, which exposes ASA
 * amounts and USD values but not ALGO-denominated amounts.
 */
type SwapStatusPayload = {
    [Key.InputAsaId]: string
    [Key.InputAsaName]: string
    [Key.InputAmountAsAsa]: number
    [Key.InputAmountAsUsd]?: number
    [Key.InputAmountAsAlgo]?: number
    [Key.OutputAsaId]: string
    [Key.OutputAsaName]: string
    [Key.OutputAmountAsAsa]: number
    [Key.OutputAmountAsUsd]?: number
    [Key.OutputAmountAsAlgo]?: number
    [Key.SwapDate]: string
    [Key.SwapDateTimestamp]: number
    [Key.SwapAddress]: string
}

export interface SwapRequiredPayloads {
    [SwapEvent.SelectTopAsset]: {
        [Key.AssetName]: string
    }
    [SwapEvent.SelectBottomAsset]: {
        [Key.AssetName]: string
    }
    [SwapEvent.SelectFromToken]: {
        [Key.AssetId]: string
    }
    [SwapEvent.SelectToToken]: {
        [Key.AssetId]: string
    }
    [SwapEvent.Completed]: SwapStatusPayload & {
        [Key.PeraFeeAsAlgo]?: number
        [Key.PeraFeeAsUsd]?: number
        [Key.ExchangeFeeAsAlgo]?: number
        [Key.NetworkFeeAsAlgo]?: number
    }
    [SwapEvent.Failed]: SwapStatusPayload
}

export interface SwapOptionalPayloads {
    [SwapEvent.SelectTopPair]: {
        [Key.SwapPairing]?: string
    }
    [SwapEvent.HistorySeeAll]: {
        [Key.SwapPairing]?: string
    }
    [SwapEvent.SelectHistory]: {
        [Key.SwapPairing]?: string
    }
    [SwapEvent.SelectHistoryInSeeAll]: {
        [Key.SwapPairing]?: string
    }
    [SwapEvent.SelectProviderOpen]: {
        [Key.RouterName]?: string
    }
    [SwapEvent.SelectProviderRouter]: {
        [Key.RouterName]?: string
    }
}
