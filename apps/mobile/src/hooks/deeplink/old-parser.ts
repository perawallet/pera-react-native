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

import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    type AnyParsedDeeplink,
    DeeplinkType,
    type AddressActionsDeeplink,
    type AlgoTransferDeeplink,
    type AssetTransferDeeplink,
    type KeyregDeeplink,
    type KeyregParticipationFields,
    type AssetOptInDeeplink,
    type AssetTransactionsDeeplink,
    type AssetInboxDeeplink,
    type DiscoverBrowserDeeplink,
    type DiscoverPathDeeplink,
    type CardsDeeplink,
    type StakingDeeplink,
    type HomeDeeplink,
} from './types'
import {
    decodeBase64Param,
    inferKeyregType,
    isValidAssetId,
    normalizeUrl,
    parseQueryParams,
} from './utils'
import { PERAWALLET_SCHEME } from './constants'
import { ALGO_ASSET_ID, type Nullable } from '@perawallet/wallet-core-shared'

/**
 * Parse Perawallet old-style URIs: perawallet://ADDRESS?params
 */
export const parsePerawalletUri = (
    url: string,
): Nullable<AnyParsedDeeplink> => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith(`${PERAWALLET_SCHEME}://`)) {
        return null
    }

    const params = parseQueryParams(normalizedUrl)

    // ARC-90: assetid = 1*DIGIT. `asset` feeds every asset-bearing branch
    // below; reject a present-but-non-numeric id once, here, so the link
    // reads as unrecognized instead of forming an opt-in/transfer that
    // fails later at BigInt(assetId).
    if (params.asset && !isValidAssetId(params.asset)) return null

    const schemeEnd = normalizedUrl.indexOf('://') + 3
    const queryStart = normalizedUrl.indexOf('?')
    const pathPart =
        queryStart !== -1
            ? normalizedUrl.slice(schemeEnd, queryStart)
            : normalizedUrl.slice(schemeEnd)

    if (pathPart === 'asset/opt-in' || pathPart.includes('asset/opt-in')) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
            address: params.account,
        } as AssetOptInDeeplink
    }

    if (pathPart === 'asset/transactions') {
        return {
            type: DeeplinkType.ASSET_TRANSACTIONS,
            sourceUrl: url,
            address: params.account || '',
            assetId: params.asset || ALGO_ASSET_ID,
        } as AssetTransactionsDeeplink
    }

    if (pathPart === 'discover' || normalizedUrl.includes('discover')) {
        return {
            type: DeeplinkType.DISCOVER_PATH,
            sourceUrl: url,
            path: params.path,
        } as DiscoverPathDeeplink
    }

    if (pathPart === 'cards' || normalizedUrl.includes('cards')) {
        return {
            type: DeeplinkType.CARDS,
            sourceUrl: url,
            path: params.path || '',
        } as CardsDeeplink
    }

    if (pathPart === 'staking' || normalizedUrl.includes('staking')) {
        return {
            type: DeeplinkType.STAKING,
            sourceUrl: url,
            path: params.path,
        } as StakingDeeplink
    }

    if (pathPart === 'asset-inbox') {
        return {
            type: DeeplinkType.ASSET_INBOX,
            sourceUrl: url,
            address: params.account,
        } as AssetInboxDeeplink
    }

    if (!pathPart && params.amount === '0' && params.asset) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
        } as AssetOptInDeeplink
    }

    if (params.url && !isValidAlgorandAddress(pathPart)) {
        const decodedUrl = decodeBase64Param(params.url)
        return {
            type: DeeplinkType.DISCOVER_BROWSER,
            sourceUrl: url,
            url: decodedUrl,
        } as DiscoverBrowserDeeplink
    }

    const address = pathPart

    if (params.type === 'asset/opt-in' && params.asset) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
            address: params.account || address,
        } as AssetOptInDeeplink
    }

    if (params.type === 'asset/transactions' && params.asset) {
        return {
            type: DeeplinkType.ASSET_TRANSACTIONS,
            sourceUrl: url,
            address: params.account || address,
            assetId: params.asset,
        } as AssetTransactionsDeeplink
    }

    if (params.type === 'asset-inbox') {
        return {
            type: DeeplinkType.ASSET_INBOX,
            sourceUrl: url,
            address: params.account || address,
        } as AssetInboxDeeplink
    }

    if (!pathPart || !isValidAlgorandAddress(pathPart)) {
        return {
            type: DeeplinkType.HOME,
            sourceUrl: url,
        } as HomeDeeplink
    }

    if (params.type === 'keyreg') {
        const participation: KeyregParticipationFields = {
            voteKey: params.votekey,
            selkey: params.selkey,
            sprfkey: params.sprfkey,
            votefst: params.votefst,
            votelst: params.votelst,
            votekd: params.votekd,
        }

        return {
            type: DeeplinkType.KEYREG,
            sourceUrl: url,
            senderAddress: address,
            keyregType: inferKeyregType(participation),
            ...participation,
            fee: params.fee,
            note: params.note,
        } as KeyregDeeplink
    }

    if (params.amount === '0' && params.asset) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.asset,
            address,
        } as AssetOptInDeeplink
    }

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

    if (params.amount && !params.asset) {
        return {
            type: DeeplinkType.ALGO_TRANSFER,
            sourceUrl: url,
            receiverAddress: address,
            amount: params.amount,
            note: params.note,
        } as AlgoTransferDeeplink
    }

    return {
        type: DeeplinkType.ADDRESS_ACTIONS,
        sourceUrl: url,
        address,
    } as AddressActionsDeeplink
}
