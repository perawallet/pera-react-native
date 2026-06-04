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

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/**
 * Swap flow. Note: iOS defined `swapAssetFailed` mapped to the same raw string
 * as `Failed` (`swapscr_assets_failed`); the duplicate was dropped.
 */
export enum SwapEvent {
    OpenSelectAccount = 'swapscr_account_select_open',
    SelectTopAsset = 'swapscr_asset_top_select',
    SelectBottomAsset = 'swapscr_asset_bot_select',
    HistorySeeAll = 'swapscr_swap_history_see_all',
    SelectHistory = 'swapscr_swap_history_select',
    SelectHistoryInSeeAll = 'swapscr_swap_history_see_all_asset_select',
    SelectTopPair = 'swapscr_swap_top_select',
    SelectProviderOpen = 'swapscr_swap_select_provider',
    SelectProviderClose = 'swapscr_swap_select_provider_close',
    SelectProviderApply = 'swapscr_swap_select_provider_apply',
    SelectProviderRouter = 'swapscr_swap_select_provider_router',
    SettingsClose = 'swapscr_swap_settings_close',
    SettingsApply = 'swapscr_swap_settings_apply',
    SettingsPercentage = 'swapscr_swap_settings_balance_percent',
    SettingsSlippage = 'swapscr_swap_settings_slippage_percent',
    SettingsLocalCurrencyOn = 'swapscr_swap_settings_local_currency_on',
    SettingsLocalCurrencyOff = 'swapscr_swap_settings_local_currency_off',
    Completed = 'swapscr_assets_completed',
    Failed = 'swapscr_assets_failed',
    Confirm = 'swapscr_assets_confirm',
    ConfirmSwapButton = 'swapscr_assets_swap',
    EnterNumbers = 'swapscr_enter_amount_tap',
    SelectFromToken = 'swapscr_select_top_asset_tap',
    SelectToToken = 'swapscr_select_lower_asset_tap',
    BannerLater = 'banner_swap_later',
    BannerTry = 'banner_swap_tryswap',
}

/** Shared status metadata for completed / failed swaps. */
type SwapStatusPayload = {
    [Key.InputAsaId]: string
    [Key.InputAsaName]: string
    [Key.InputAmountAsAsa]: number
    [Key.InputAmountAsUsd]: number
    [Key.InputAmountAsAlgo]: number
    [Key.OutputAsaId]: string
    [Key.OutputAsaName]: string
    [Key.OutputAmountAsAsa]: number
    [Key.OutputAmountAsUsd]: number
    [Key.OutputAmountAsAlgo]: number
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
        [Key.PeraFeeAsAlgo]: number
        [Key.PeraFeeAsUsd]: number
        [Key.ExchangeFeeAsAlgo]: number
        [Key.NetworkFeeAsAlgo]: number
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
    [SwapEvent.SelectProviderClose]: {
        [Key.RouterName]?: string
    }
    [SwapEvent.SelectProviderApply]: {
        [Key.RouterName]?: string
    }
    [SwapEvent.SelectProviderRouter]: {
        [Key.RouterName]?: string
    }
}
