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

import { i18nKey, type AssetRef } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../chain-id'

// Shared by the history summary and a built transaction's summary, which
// signing reaches without loading the history code.
export const SEND_TITLE_KEY = i18nKey('transactions.list_item.send')
export const OPT_IN_TITLE_KEY = i18nKey('transactions.list_item.opt_in')
export const OPT_OUT_TITLE_KEY = i18nKey('transactions.list_item.opt_out')
export const ASSET_CONFIG_TITLE_KEY = i18nKey(
    'transactions.list_item.asset_config',
)
export const ASSET_FREEZE_TITLE_KEY = i18nKey(
    'transactions.list_item.asset_freeze',
)
export const APP_CALL_TITLE_KEY = i18nKey('transactions.list_item.app_call')
export const KEY_REGISTRATION_TITLE_KEY = i18nKey(
    'transactions.list_item.key_registration',
)
export const DEFAULT_TITLE_KEY = i18nKey('transactions.list_item.default')

export const assetRefOf = (assetId: string): AssetRef => ({
    chainId: ALGORAND_CHAIN_ID,
    assetId,
})
