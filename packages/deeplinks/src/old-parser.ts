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

import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    type AnyParsedDeeplink,
    DeeplinkType,
    type AddressActionsDeeplink,
    type TransferDeeplink,
    type ChainActionDeeplink,
    type AssetOptInDeeplink,
    type AssetTransactionsDeeplink,
    type AssetInboxDeeplink,
    type DiscoverBrowserDeeplink,
    type DiscoverPathDeeplink,
    type CardsDeeplink,
    type StakingDeeplink,
    type HomeDeeplink,
} from './links'
import {
    isPeraLinkAddress,
    peraLinkTarget,
    toPeraKeyregAction,
    toPeraLinkAssetRef,
    toPeraPaymentData,
} from './pera-link-chain'
import {
    decodeBase64Param,
    normalizeUrl,
    parseQueryParams,
    readBaseUnits,
} from './utils'
import { PERAWALLET_SCHEME } from './constants'

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

    // `asset` feeds every asset-bearing branch below; reject a present id the
    // chain can't spell once, here, so the link reads as unrecognized instead
    // of forming an opt-in/transfer that fails later.
    const assetRef = params.asset ? toPeraLinkAssetRef(params.asset) : undefined
    if (params.asset && !assetRef) return null

    const target = peraLinkTarget()

    const schemeEnd = normalizedUrl.indexOf('://') + 3
    const queryStart = normalizedUrl.indexOf('?')
    const pathPart =
        queryStart !== -1
            ? normalizedUrl.slice(schemeEnd, queryStart)
            : normalizedUrl.slice(schemeEnd)

    if (pathPart === 'asset/opt-in' || pathPart.includes('asset/opt-in')) {
        // A missing asset id leaves nothing to opt in to.
        if (!assetRef) return null
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            target,
            assetRef,
            address: params.account,
        } as AssetOptInDeeplink
    }

    if (pathPart === 'asset/transactions') {
        return {
            type: DeeplinkType.ASSET_TRANSACTIONS,
            sourceUrl: url,
            target,
            address: params.account || '',
            assetRef,
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
            target,
            address: params.account,
        } as AssetInboxDeeplink
    }

    if (!pathPart && params.amount === '0' && assetRef) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            target,
            assetRef,
        } as AssetOptInDeeplink
    }

    if (params.url && !isPeraLinkAddress(pathPart)) {
        const decodedUrl = decodeBase64Param(params.url)
        return {
            type: DeeplinkType.DISCOVER_BROWSER,
            sourceUrl: url,
            url: decodedUrl,
        } as DiscoverBrowserDeeplink
    }

    const address = pathPart

    if (params.type === 'asset/opt-in' && assetRef) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            target,
            assetRef,
            address: params.account || address,
        } as AssetOptInDeeplink
    }

    if (params.type === 'asset/transactions' && assetRef) {
        return {
            type: DeeplinkType.ASSET_TRANSACTIONS,
            sourceUrl: url,
            target,
            address: params.account || address,
            assetRef,
        } as AssetTransactionsDeeplink
    }

    if (params.type === 'asset-inbox') {
        return {
            type: DeeplinkType.ASSET_INBOX,
            sourceUrl: url,
            target,
            address: params.account || address,
        } as AssetInboxDeeplink
    }

    if (!pathPart || !isPeraLinkAddress(pathPart)) {
        return {
            type: DeeplinkType.HOME,
            sourceUrl: url,
        } as HomeDeeplink
    }

    if (params.type === 'keyreg') {
        const chainData = toPeraKeyregAction({
            sender: address,
            voteKey: params.votekey,
            selectionKey: params.selkey,
            stateProofKey: params.sprfkey,
            voteFirst: params.votefst,
            voteLast: params.votelst,
            voteKeyDilution: params.votekd,
            feeParam: params.fee,
            note: params.note,
        })
        if (!chainData) return null

        return {
            type: DeeplinkType.CHAIN_ACTION,
            sourceUrl: url,
            target,
            chainData,
        } as ChainActionDeeplink
    }

    if (params.amount === '0' && assetRef) {
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            target,
            assetRef,
            address,
        } as AssetOptInDeeplink
    }

    if (
        (assetRef && params.amount && params.amount !== '0') ||
        (params.amount && !assetRef)
    ) {
        const amount = readBaseUnits(params.amount)
        if (!amount) return null
        return {
            type: DeeplinkType.TRANSFER,
            sourceUrl: url,
            target,
            receiverAddress: address,
            assetRef,
            amount,
            note: params.note,
            chainData: toPeraPaymentData(params.xnote),
        } as TransferDeeplink
    }

    return {
        type: DeeplinkType.ADDRESS_ACTIONS,
        sourceUrl: url,
        target,
        address,
    } as AddressActionsDeeplink
}
