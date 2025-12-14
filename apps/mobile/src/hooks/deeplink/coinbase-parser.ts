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

import {
    CoinbaseAssetTransferDeeplink,
    DeeplinkType,
} from './types'
import { normalizeUrl, parseQueryParams } from './utils'

/**
 * Parse Coinbase format: algo:ASSET_ID/transfer?address=ADDRESS
 */
export const parseCoinbaseFormat = (url: string): CoinbaseAssetTransferDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith('algo:')) {
        return null
    }

    const params = parseQueryParams(normalizedUrl)

    const parts = normalizedUrl.split('/')

    if (parts.length < 2) return null

    const assetPart = parts[0].replace('algo:', '')
    const actionPart = parts[1].split('?')[0]

    if (actionPart === 'transfer' && params.address) {
        return {
            type: DeeplinkType.COINBASE_ASSET_TRANSFER,
            sourceUrl: url,
            assetId: assetPart,
            address: params.address,
        }
    }

    return null
}
