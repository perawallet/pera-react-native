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
    type AddContactDeeplink,
    type EditContactDeeplink,
    type AddWatchAccountDeeplink,
    type ReceiverAccountSelectionDeeplink,
    type AddressActionsDeeplink,
    type TransferDeeplink,
    type ChainActionDeeplink,
    type RecoverAddressDeeplink,
    type WalletConnectDeeplink,
    type AssetOptInDeeplink,
    type AssetDetailDeeplink,
    type AssetInboxDeeplink,
    type DiscoverBrowserDeeplink,
    type DiscoverPathDeeplink,
    type CardsDeeplink,
    type StakingDeeplink,
    type SwapDeeplink,
    type BuyDeeplink,
    type SellDeeplink,
    type AccountDetailDeeplink,
    type InternalBrowserDeeplink,
    type SharedAccountImportDeeplink,
    type SignRequestDeeplink,
    type HomeDeeplink,
} from './links'
import {
    isChainScopedPeraPath,
    peraLinkTarget,
    resolvePeraLinkTarget,
    toLinkAssetRef,
    toPeraKeyregAction,
    toPeraPaymentData,
} from './pera-link-chain'
import {
    decodeBase64Param,
    extractPath,
    normalizeUrl,
    parseQueryParams,
    readBaseUnits,
} from './utils'
import { PERAWALLET_SCHEME } from './constants'

/**
 * Parse Perawallet new-style URIs: perawallet://app/path?params
 */
export function parsePerawalletAppUri(
    url: string,
): Nullable<AnyParsedDeeplink> {
    const normalizedUrl = normalizeUrl(url)

    if (
        !normalizedUrl.includes('/app/') &&
        !normalizedUrl.startsWith(`${PERAWALLET_SCHEME}://app`)
    ) {
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

    // Algorand-only and chain-agnostic paths ignore `chain=`.
    const resolution = isChainScopedPeraPath(cleanPath)
        ? resolvePeraLinkTarget(params.chain)
        : { ok: true as const, target: peraLinkTarget() }
    if (!resolution.ok) return null
    const { target } = resolution

    if (cleanPath === 'add-contact') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ADD_CONTACT,
            sourceUrl: url,
            target,
            address: params.address,
            label: params.label,
        } as AddContactDeeplink
    }

    if (cleanPath === 'edit-contact') {
        if (!params.address) return null
        return {
            type: DeeplinkType.EDIT_CONTACT,
            sourceUrl: url,
            target,
            address: params.address,
            label: params.label,
        } as EditContactDeeplink
    }

    // Native pera apps accept both spellings (iOS AppEndpoint cases
    // `addWatchAccount` and `registerWatchAccount` route to the same flow;
    // android `CreateNewDeepLinkImpl` uses `add-watch-account`).
    if (
        cleanPath === 'register-watch-account' ||
        cleanPath === 'add-watch-account'
    ) {
        if (!params.address) return null
        return {
            type: DeeplinkType.ADD_WATCH_ACCOUNT,
            sourceUrl: url,
            target,
            address: params.address,
            label: params.label,
        } as AddWatchAccountDeeplink
    }

    if (cleanPath === 'receiver-account-selection') {
        if (!params.address) return null
        return {
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
            sourceUrl: url,
            target,
            address: params.address,
        } as ReceiverAccountSelectionDeeplink
    }

    if (cleanPath === 'address-actions') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: url,
            target,
            address: params.address,
            label: params.label,
        } as AddressActionsDeeplink
    }

    if (cleanPath === 'asset-transfer') {
        if (!params.receiverAddress) return null
        // An absent asset id means the native asset; a present one the chain
        // can't spell makes the link unrecognized.
        const assetRef = params.assetId
            ? toLinkAssetRef(target, params.assetId)
            : undefined
        if (params.assetId && !assetRef) return null

        const amount = params.amount ? readBaseUnits(params.amount) : undefined
        if (params.amount && !amount) return null

        return {
            type: DeeplinkType.TRANSFER,
            sourceUrl: url,
            target,
            receiverAddress: params.receiverAddress,
            assetRef,
            amount,
            note: params.note,
            label: params.label,
            chainData: toPeraPaymentData(params.xnote),
        } as TransferDeeplink
    }

    if (cleanPath === 'keyreg') {
        if (!params.senderAddress && !params.address) return null

        const chainData = toPeraKeyregAction({
            sender: params.senderAddress || params.address,
            keyregType:
                params.type === 'online' || params.type === 'offline'
                    ? params.type
                    : undefined,
            voteKey: params.voteKey || params.votekey,
            selectionKey: params.selkey,
            stateProofKey: params.sprfkey,
            voteFirst: params.votefst,
            voteLast: params.votelst,
            voteKeyDilution: params.votekd,
            feeParam: params.fee,
            note: params.note,
            xnote: params.xnote,
        })
        if (!chainData) return null

        return {
            type: DeeplinkType.CHAIN_ACTION,
            sourceUrl: url,
            target,
            chainData,
        } as ChainActionDeeplink
    }

    if (cleanPath === 'recover-address') {
        if (!params.mnemonic) return null
        return {
            type: DeeplinkType.RECOVER_ADDRESS,
            // `url` embeds `?mnemonic=` — dropped so the secret never rides
            // on the parsed deeplink. Mirrors parseLegacyMnemonicJson.
            sourceUrl: '',
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
        const assetRef = params.assetId
            ? toLinkAssetRef(target, params.assetId)
            : undefined
        if (!assetRef) return null
        return {
            type: DeeplinkType.ASSET_OPT_IN,
            sourceUrl: url,
            target,
            assetRef,
            address: params.address,
        } as AssetOptInDeeplink
    }

    if (cleanPath === 'asset-detail') {
        const assetRef = params.assetId
            ? toLinkAssetRef(target, params.assetId)
            : undefined
        if (!params.address || !assetRef) return null
        return {
            type: DeeplinkType.ASSET_DETAIL,
            sourceUrl: url,
            target,
            address: params.address,
            assetRef,
        } as AssetDetailDeeplink
    }

    if (cleanPath === 'asset-inbox') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ASSET_INBOX,
            sourceUrl: url,
            target,
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
            target,
            address: params.address,
            assetInRef: params.assetInId
                ? toLinkAssetRef(target, params.assetInId)
                : undefined,
            assetOutRef: params.assetOutId
                ? toLinkAssetRef(target, params.assetOutId)
                : undefined,
        } as SwapDeeplink
    }

    if (cleanPath === 'buy') {
        return {
            type: DeeplinkType.BUY,
            sourceUrl: url,
            target,
            address: params.address,
        } as BuyDeeplink
    }

    if (cleanPath === 'sell') {
        return {
            type: DeeplinkType.SELL,
            sourceUrl: url,
            target,
            address: params.address,
        } as SellDeeplink
    }

    if (cleanPath === 'account-detail') {
        if (!params.address) return null
        return {
            type: DeeplinkType.ACCOUNT_DETAIL,
            sourceUrl: url,
            target,
            address: params.address,
        } as AccountDetailDeeplink
    }

    if (
        cleanPath === 'shared-account-import' ||
        cleanPath === 'joint-account-import'
    ) {
        if (!params.address) return null
        return {
            type: DeeplinkType.SHARED_ACCOUNT_IMPORT,
            sourceUrl: url,
            target,
            address: params.address,
        } as SharedAccountImportDeeplink
    }

    // Both the multisig (`joint-`) and react-native (`shared-`) account
    // sign-request paths, plus the bare `sign-request` form, carry the same
    // `signRequestId` and open the same pending-signatures sheet.
    if (
        cleanPath === 'sign-request' ||
        cleanPath === 'joint-account-sign-request' ||
        cleanPath === 'shared-account-sign-request'
    ) {
        if (!params.signRequestId) return null
        return {
            type: DeeplinkType.SIGN_REQUEST,
            sourceUrl: url,
            signRequestId: params.signRequestId,
        } as SignRequestDeeplink
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
