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

import {
    ALGO_ASSET_ID,
    isAlgoAssetId,
    isAlgoAssetName,
} from '@perawallet/wallet-core-shared'

import type { RampHistoryItem, RampToken } from './models'

/** Whether any order in a ramp history slice still awaits user attention. */
export const hasPendingRampOrder = (items: RampHistoryItem[]): boolean =>
    items.some(item => item.status === 'pending')

/**
 * Whether a ramp-catalog token is native ALGO.
 *
 * Identity comes from the asset id whenever the provider supplies one (XO
 * does), because an id cannot be chosen to impersonate another asset. Meld's
 * crypto entries carry only a code, so those fall back to the ticker — and
 * that fallback is the whole reason this lives at the catalog boundary rather
 * than in a renderer: the trust assumption is "the provider catalog names its
 * own listings honestly", which holds for a first-party-brokered provider list
 * and never for an on-chain unit name.
 */
export const isAlgoRampToken = (token: RampToken): boolean =>
    /^\d+$/.test(token.id)
        ? isAlgoAssetId(token.id)
        : isAlgoAssetName(token.id) || isAlgoAssetName(token.symbol)

/** The asset id a ramp token maps to, with ALGO pinned to its native id. */
export const rampTokenAssetId = (token: RampToken): string =>
    isAlgoRampToken(token) ? ALGO_ASSET_ID : token.id
