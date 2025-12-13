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
    AddContactDeeplink,
    EditContactDeeplink,
    AddWatchAccountDeeplink,
    ReceiverAccountSelectionDeeplink,
    AddressActionsDeeplink,
    AlgoTransferDeeplink,
    AssetTransferDeeplink,
    KeyregDeeplink,
    RecoverAddressDeeplink,
    WebImportDeeplink,
    WalletConnectDeeplink,
    AssetOptInDeeplink,
    AssetDetailDeeplink,
    AssetTransactionsDeeplink,
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
} from './deeplink-types'

/**
 * Parse query parameters from a URL
 */
export const parseQueryParams = (url: string): Record<string, string> => {
    const params: Record<string, string> = {}

    try {
        const urlObj = new URL(url.replace(/^([a-z-]+):\/\/(?!\/)/, '$1://placeholder/'))
        urlObj.searchParams.forEach((value, key) => {
            params[key] = decodeURIComponent(value)
        })
    } catch {
        // Fallback for malformed URLs
        const queryStart = url.indexOf('?')
        if (queryStart === -1) return params

        const queryString = url.slice(queryStart + 1)
        queryString.split('&').forEach((pair) => {
            const [key, value] = pair.split('=')
            if (key) {
                params[key] = value ? decodeURIComponent(value) : ''
            }
        })
    }

    return params
}

/**
 * Decode base64-encoded parameter
 */
export const decodeBase64Param = (param: string): string => {
    try {
        return Buffer.from(param, 'base64').toString('utf-8')
    } catch {
        return param
    }
}

/**
 * Normalize URL by trimming and lowercasing only the scheme part
 * Preserves case in the rest of the URL (important for addresses)
 */
export const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/)
    if (schemeMatch) {
        return schemeMatch[1].toLowerCase() + ':' + schemeMatch[2]
    }
    return trimmed.toLowerCase()
}

const extractPath = (url: string): string => {
    try {
        const appIndex = url.indexOf('/app/')
        if (appIndex !== -1) {
            const pathStart = appIndex + 5 // length of '/app/'
            const queryIndex = url.indexOf('?', pathStart)
            return queryIndex !== -1 ? url.slice(pathStart, queryIndex) : url.slice(pathStart)
        }
        return ''
    } catch {
        return ''
    }
}

/**
 * Parse WalletConnect URIs: wc:// or perawallet-wc://
 * These are NOT parsed, just wrapped and normalized for the WalletConnect library to handle
 */
export const parseWalletConnectUri = (url: string): WalletConnectDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith('wc:') && !normalizedUrl.startsWith('perawallet-wc:')) {
        return null
    }

    // Normalize perawallet-wc:// to wc://
    let wcUri = normalizedUrl
    if (normalizedUrl.startsWith('perawallet-wc:')) {
        wcUri = normalizedUrl.replace('perawallet-wc:', 'wc:')
    }

    return {
        type: DeeplinkType.WALLET_CONNECT,
        sourceUrl: url,
        uri: wcUri,
    }
}

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

/**
 * Parse Perawallet old-style URIs: perawallet://ADDRESS?params
 */
export const parsePerawalletUri = (url: string): AnyParsedDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith('perawallet://')) {
        return null
    }

    const params = parseQueryParams(normalizedUrl)

    const schemeEnd = normalizedUrl.indexOf('://') + 3
    const queryStart = normalizedUrl.indexOf('?')
    const pathPart = queryStart !== -1
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

    if (!pathPart || !isValidAlgorandAddress(pathPart)) {
        return {
            type: DeeplinkType.HOME,
            sourceUrl: url,
        } as HomeDeeplink
    }

    const address = pathPart

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

    if (cleanPath === 'register-watch-account' || cleanPath === 'add-watch-account') {
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

    if (cleanPath === 'web-import') {
        if (!params.backupId || !params.encryptionKey || !params.action) return null
        return {
            type: DeeplinkType.WEB_IMPORT,
            sourceUrl: url,
            backupId: params.backupId,
            encryptionKey: params.encryptionKey,
            action: params.action,
            version: params.version,
            platform: params.platform,
            modificationKey: params.modificationKey,
        } as WebImportDeeplink
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

/**
 * Parse Universal Links: https://perawallet.app/...
 */
const parseUniversalLink = (url: string): AnyParsedDeeplink | null => {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl.startsWith('https://perawallet.app/')) {
        return null
    }

    if (normalizedUrl.includes('/qr/perawallet/app/')) {
        const convertedUrl = url.replace('https://perawallet.app/qr/perawallet/app/', 'perawallet://app/')
        return parsePerawalletAppUri(convertedUrl)
    } else if (normalizedUrl.includes('/qr/perawallet/')) {
        const convertedUrl = url.replace('https://perawallet.app/qr/perawallet/', 'perawallet://')
        return parsePerawalletUri(convertedUrl)
    }

    return null
}

/**
 * Main deeplink parser - determines format and calls appropriate parser
 */
export const parseDeeplink = (url: string): AnyParsedDeeplink | null => {
    if (!url || typeof url !== 'string') return null

    const normalizedUrl = normalizeUrl(url)

    if (normalizedUrl.startsWith('wc:') || normalizedUrl.startsWith('perawallet-wc:')) {
        return parseWalletConnectUri(url)
    }

    if (normalizedUrl.startsWith('algorand://')) {
        return parseAlgorandUri(url)
    }

    if (normalizedUrl.startsWith('https://perawallet.app/')) {
        return parseUniversalLink(url)
    }

    if (normalizedUrl.includes('/app/')) {
        const result = parsePerawalletAppUri(url)
        if (result) return result
    }

    if (normalizedUrl.startsWith('perawallet://')) {
        const result = parsePerawalletUri(url)
        if (result) return result
    }

    return null
}
