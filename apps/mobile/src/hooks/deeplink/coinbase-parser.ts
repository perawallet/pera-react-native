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
    AddressActionsDeeplink,
    AssetTransferDeeplink,
    DeeplinkType,
} from './types'
import { normalizeUrl, parseQueryParams } from './utils'
import { ALGO_SCHEME } from './constants'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'

const ALGO_URI_PREFIX = `${ALGO_SCHEME}:`

/**
 * Parse Coinbase format: algo:ASSET_ID/transfer?address=ADDRESS
 */
export const parseCoinbaseFormat = (
    url: string,
): Nullable<AssetTransferDeeplink | AddressActionsDeeplink> => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith(ALGO_URI_PREFIX)) {
        return null
    }

    const params = parseQueryParams(normalizedUrl)

    const parts = normalizedUrl.split('/')

    if (parts.length < 2) {
        const address = parts[0].replace(ALGO_URI_PREFIX, '')

        if (isValidAlgorandAddress(address)) {
            return {
                type: DeeplinkType.ADDRESS_ACTIONS,
                sourceUrl: url,
                address,
            }
        }
        return null
    }

    const assetPart = parts[0].replace(ALGO_URI_PREFIX, '')
    const actionPart = parts[1].split('?')[0]

    if (actionPart === 'transfer' && params.address) {
        return {
            type: DeeplinkType.ASSET_TRANSFER,
            sourceUrl: url,
            assetId: assetPart,
            receiverAddress: params.address,
        }
    }

    return null
}
