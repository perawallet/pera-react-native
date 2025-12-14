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
    AnyParsedDeeplink,
    DeeplinkType,
    AddContactDeeplink,
    EditContactDeeplink,
    AddWatchAccountDeeplink,
    ReceiverAccountSelectionDeeplink,
    AddressActionsDeeplink,
    AlgoTransferDeeplink,
    AssetTransferDeeplink,
    KeyregDeeplink,
    RecoverAddressDeeplink,
    WalletConnectDeeplink,
    AssetOptInDeeplink,
    AssetDetailDeeplink,
    AssetInboxDeeplink,
    DiscoverBrowserDeeplink,
    DiscoverPathDeeplink,
    CardsDeeplink,
    StakingDeeplink,
    SwapDeeplink,
    BuyDeeplink,
    SellDeeplink,
    AccountDetailDeeplink,
    InternalBrowserDeeplink,
    HomeDeeplink,
} from './types'
import { decodeBase64Param, extractPath, normalizeUrl, parseQueryParams } from './utils'

/**
 * Parse Perawallet new-style URIs: perawallet://app/path?params
 */
export function parsePerawalletAppUri(url: string): AnyParsedDeeplink | null {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.includes('/app/') && !normalizedUrl.startsWith('perawallet://app')) {
        return null
    }

    const path = extractPath(normalizedUrl)
    const params = parseQueryParams(normalizedUrl)

    if (!path && Object.keys(params).length === 0) {
        return {
            type: DeeplinkType.HOME,
            sourceUrl: url,
        } as HomeDeeplink
    }

    const cleanPath = path.replace(/\/$/, '')

    if (cleanPath === 'add-contact') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ADD_CONTACT,
            sourceUrl: url,
            address: params.address,
            label: params.label,
        } as AddContactDeeplink
    }

    if (cleanPath === 'edit-contact') {
        if (!params.address) return null
        return {
            type: DeeplinkType.EDIT_CONTACT,
            sourceUrl: url,
            address: params.address,
            label: params.label,
        } as EditContactDeeplink
    }

    if (cleanPath === 'register-watch-account') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ADD_WATCH_ACCOUNT,
            sourceUrl: url,
            address: params.address,
            label: params.label,
        } as AddWatchAccountDeeplink
    }

    if (cleanPath === 'receiver-account-selection') {
        if (!params.address) return null
        return {
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
            sourceUrl: url,
            address: params.address,
        } as ReceiverAccountSelectionDeeplink
    }

    if (cleanPath === 'address-actions') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: url,
            address: params.address,
            label: params.label,
        } as AddressActionsDeeplink
    }

    if (cleanPath === 'asset-transfer') {
        if (!params.receiverAddress) return null

        const assetId = params.assetId || '0'

        if (assetId === '0') {
            return {
                type: DeeplinkType.ALGO_TRANSFER,
                sourceUrl: url,
                receiverAddress: params.receiverAddress,
                amount: params.amount,
                note: params.note,
                xnote: params.xnote,
                label: params.label,
            } as AlgoTransferDeeplink
        }

        return {
            type: DeeplinkType.ASSET_TRANSFER,
            sourceUrl: url,
            assetId,
            receiverAddress: params.receiverAddress,
            amount: params.amount,
            note: params.note,
            xnote: params.xnote,
            label: params.label,
        } as AssetTransferDeeplink
    }

    if (cleanPath === 'keyreg') {
        if (!params.senderAddress && !params.address) return null
        return {
            type: DeeplinkType.KEYREG,
            sourceUrl: url,
            senderAddress: params.senderAddress || params.address,
            keyregType: params.type || 'keyreg',
            voteKey: params.voteKey || params.votekey,
            selkey: params.selkey,
            sprfkey: params.sprfkey,
            votefst: params.votefst,
            votelst: params.votelst,
            votekd: params.votekd,
            fee: params.fee,
            note: params.note,
            xnote: params.xnote,
        } as KeyregDeeplink
    }

    if (cleanPath === 'recover-address') {
        if (!params.mnemonic) return null
        return {
            type: DeeplinkType.RECOVER_ADDRESS,
            sourceUrl: url,
            mnemonic: params.mnemonic,
        } as RecoverAddressDeeplink
    }

    if (cleanPath === 'wallet-connect') {
        const uri = params.uri || params.walletConnectUrl
        if (!uri) return null

        const decodedUri = decodeBase64Param(uri)

        return {
            type: DeeplinkType.WALLET_CONNECT,
            sourceUrl: url,
            uri: decodedUri,
        } as WalletConnectDeeplink
    }

    if (cleanPath === 'asset-opt-in') {
        if (!params.assetId) return null
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            assetId: params.assetId,
            address: params.address,
        } as AssetOptInDeeplink
    }

    if (cleanPath === 'asset-detail') {
        if (!params.address || !params.assetId) return null
        return {
            type: DeeplinkType.ASSET_DETAIL,
            sourceUrl: url,
            address: params.address,
            assetId: params.assetId,
        } as AssetDetailDeeplink
    }

    if (cleanPath === 'asset-inbox') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ASSET_INBOX,
            sourceUrl: url,
            address: params.address,
        } as AssetInboxDeeplink
    }

    if (cleanPath === 'discover-browser') {
        if (!params.url) return null
        const decodedUrl = decodeBase64Param(params.url)
        return {
            type: DeeplinkType.DISCOVER_BROWSER,
            sourceUrl: url,
            url: decodedUrl,
        } as DiscoverBrowserDeeplink
    }

    if (cleanPath === 'discover-path' || cleanPath === 'discover') {
        return {
            type: DeeplinkType.DISCOVER_PATH,
            sourceUrl: url,
            path: params.path,
        } as DiscoverPathDeeplink
    }

    if (cleanPath === 'cards-path' || cleanPath === 'cards') {
        return {
            type: DeeplinkType.CARDS,
            sourceUrl: url,
            path: params.path || '',
        } as CardsDeeplink
    }

    if (cleanPath === 'staking-path' || cleanPath === 'staking') {
        return {
            type: DeeplinkType.STAKING,
            sourceUrl: url,
            path: params.path,
        } as StakingDeeplink
    }

    if (cleanPath === 'swap') {
        return {
            type: DeeplinkType.SWAP,
            sourceUrl: url,
            address: params.address,
            assetInId: params.assetInId,
            assetOutId: params.assetOutId,
        } as SwapDeeplink
    }

    if (cleanPath === 'buy') {
        return {
            type: DeeplinkType.BUY,
            sourceUrl: url,
            address: params.address,
        } as BuyDeeplink
    }

    if (cleanPath === 'sell') {
        return {
            type: DeeplinkType.SELL,
            sourceUrl: url,
            address: params.address,
        } as SellDeeplink
    }

    if (cleanPath === 'account-detail') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ACCOUNT_DETAIL,
            sourceUrl: url,
            address: params.address,
        } as AccountDetailDeeplink
    }

    if (cleanPath === 'internal-browser') {
        if (!params.url) return null
        const decodedUrl = decodeBase64Param(params.url)
        return {
            type: DeeplinkType.INTERNAL_BROWSER,
            sourceUrl: url,
            url: decodedUrl,
        } as InternalBrowserDeeplink
    }

    if (!cleanPath || cleanPath === '') {
        return {
            type: DeeplinkType.HOME,
            sourceUrl: url,
        } as HomeDeeplink
    }

    return null
}