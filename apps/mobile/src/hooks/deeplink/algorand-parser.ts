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

import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    AnyParsedDeeplink,
    DeeplinkType,
    AddressActionsDeeplink,
    AlgoTransferDeeplink,
    AssetTransferDeeplink,
    KeyregDeeplink,
    AssetOptInDeeplink,
    AssetTransactionsDeeplink,
    AssetInboxDeeplink,
    DiscoverBrowserDeeplink,
    DiscoverPathDeeplink,
    CardsDeeplink,
    StakingDeeplink,
    HomeDeeplink,
} from './types'
import { decodeBase64Param, normalizeUrl, parseQueryParams } from './utils'


/**
 * Parse Algorand URIs (algorand://) according to ARC-90
 * Implements basic ARC-90 transaction URI format
 */
export const parseAlgorandUri = (url: string): AnyParsedDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith('algorand://')) {
        return null
    }

    const params = parseQueryParams(normalizedUrl)

    // Extract address from path (between :// and ?)
    const schemeEnd = normalizedUrl.indexOf('://') + 3
    const queryStart = normalizedUrl.indexOf('?')
    const pathPart = queryStart !== -1
        ? normalizedUrl.slice(schemeEnd, queryStart)
        : normalizedUrl.slice(schemeEnd)

    // Special path handling for notification types (paths that aren't addresses)
    if (pathPart === 'asset/opt-in' || pathPart.includes('asset/opt-in')) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
            address: params.account,
        } as AssetOptInDeeplink
    }

    // Check for special paths BEFORE address validation
    // Discover path: algorand://discover?path=...
    if (pathPart === 'discover' || normalizedUrl.includes('discover')) {
        return {
            type: DeeplinkType.DISCOVER_PATH,
            sourceUrl: url,
            path: params.path,
        } as DiscoverPathDeeplink
    }

    // Cards: algorand://cards?path=...
    if (pathPart === 'cards' || normalizedUrl.includes('cards')) {
        return {
            type: DeeplinkType.CARDS,
            sourceUrl: url,
            path: params.path || '',
        } as CardsDeeplink
    }

    // Staking: algorand://staking?path=...
    if (pathPart === 'staking' || normalizedUrl.includes('staking')) {
        return {
            type: DeeplinkType.STAKING,
            sourceUrl: url,
            path: params.path,
        } as StakingDeeplink
    }

    // Notification types (check before address validation since they may have non-address paths)
    if (params.type === 'asset/opt-in' && params.asset) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
            address: params.account,
        } as AssetOptInDeeplink
    }

    if (params.type === 'asset/transactions' && params.asset) {
        return {
            type: DeeplinkType.ASSET_TRANSACTIONS,
            sourceUrl: url,
            address: params.account || pathPart,
            assetId: params.asset,
        } as AssetTransactionsDeeplink
    }

    if (params.type === 'asset-inbox') {
        return {
            type: DeeplinkType.ASSET_INBOX,
            sourceUrl: url,
            address: params.account || pathPart,
        } as AssetInboxDeeplink
    }

    // Asset opt-in with empty path (algorand://?amount=0&asset=...)
    if (!pathPart && params.amount === '0' && params.asset) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
        } as AssetOptInDeeplink
    }

    // Discover browser with base64 URL (no valid address, just ?url=...)
    if (params.url && !isValidAlgorandAddress(pathPart)) {
        const decodedUrl = decodeBase64Param(params.url)
        return {
            type: DeeplinkType.DISCOVER_BROWSER,
            sourceUrl: url,
            url: decodedUrl,
        } as DiscoverBrowserDeeplink
    }

    // Home/fallback (no address, just params or empty)
    if (!pathPart || !isValidAlgorandAddress(pathPart)) {
        return {
            type: DeeplinkType.HOME,
            sourceUrl: url,
        } as HomeDeeplink
    }

    const address = pathPart

    // Keyreg transaction
    if (params.type === 'keyreg') {
        return {
            type: DeeplinkType.KEYREG,
            sourceUrl: url,
            senderAddress: address,
            keyregType: params.type,
            voteKey: params.votekey,
            selkey: params.selkey,
            sprfkey: params.sprfkey,
            votefst: params.votefst,
            votelst: params.votelst,
            votekd: params.votekd,
            fee: params.fee,
            note: params.note,
        } as KeyregDeeplink
    }

    // Asset opt-in (amount=0 & asset exists)
    if (params.amount === '0' && params.asset) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
            address,
        } as AssetOptInDeeplink
    }

    // Asset transfer (has asset param and amount > 0)
    if (params.asset && params.amount && params.amount !== '0') {
        return {
            type: DeeplinkType.ASSET_TRANSFER,
            sourceUrl: url,
            assetId: params.asset,
            receiverAddress: address,
            amount: params.amount,
            note: params.note,
            xnote: params.xnote,
        } as AssetTransferDeeplink
    }

    // ALGO transfer (has amount, no asset)
    if (params.amount && !params.asset) {
        return {
            type: DeeplinkType.ALGO_TRANSFER,
            sourceUrl: url,
            receiverAddress: address,
            amount: params.amount,
            note: params.note,
        } as AlgoTransferDeeplink
    }

    // Default: address actions (basic address scan)
    return {
        type: DeeplinkType.ADDRESS_ACTIONS,
        sourceUrl: url,
        address,
    } as AddressActionsDeeplink
}