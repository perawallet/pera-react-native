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
    type AssetOptInDeeplink,
    type KeyregDeeplink,
    type DiscoverBrowserDeeplink,
} from './types'
import { parseAlgorandURI } from './arc90-parser'
// config and Networks removed because unused
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Parse Algorand URIs (algorand://) according to ARC-90
 * Reference: https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0090.md
 *
 * Uses the custom ARC-90 parser implementation in arc90-parser.ts
 */
export const parseAlgorandUri = (url: string): Nullable<AnyParsedDeeplink> => {
    const parsed = parseAlgorandURI(url)

    if (!parsed) {
        return null
    }

    if (parsed.type === 'payment' || parsed.type === 'noop') {
        const { address, params = {} } = parsed

        const amount = params.amount
        const assetId = params.asset
        const note = params.note
        const xnote = params.xnote
        const label = params.label

        // A present-but-invalid address is corruption (e.g. a truncated QR),
        // not an address-less opt-in — reject rather than silently prompting.
        if (address && !isValidAlgorandAddress(address)) {
            return null
        }

        // Address-less by design: an opt-in has no receiver, so this resolves
        // before the address guard below.
        if (amount === '0' && assetId) {
            return {
                type: DeeplinkType.ASSET_OPT_IN,
                sourceUrl: url,
                assetId: assetId,
                address: address || undefined,
            } as AssetOptInDeeplink
        }

        if (!address || !isValidAlgorandAddress(address)) {
            return null
        }

        // Asset Transfer: Asset ID is present
        if (assetId) {
            return {
                type: DeeplinkType.ASSET_TRANSFER,
                sourceUrl: url,
                assetId: assetId,
                receiverAddress: address,
                amount: amount,
                note: note,
                xnote: xnote,
                label: label,
            } as AssetTransferDeeplink
        }

        // ALGO Transfer: Amount is present
        if (amount) {
            return {
                type: DeeplinkType.ALGO_TRANSFER,
                sourceUrl: url,
                receiverAddress: address,
                amount: amount,
                note: note,
                xnote: xnote,
                label: label,
            } as AlgoTransferDeeplink
        }

        // Default: Address Actions
        return {
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: url,
            address,
            label: label,
        } as AddressActionsDeeplink
    }

    if (parsed.type === 'keyreg') {
        const { address, params = {} } = parsed

        if (!address || !isValidAlgorandAddress(address)) {
            return null
        }

        return {
            type: DeeplinkType.KEYREG,
            sourceUrl: url,
            senderAddress: address,
            keyregType: 'keyreg',
            voteKey: params.votekey,
            selkey: params.selkey,
            sprfkey: params.sprfkey,
            votefst: params.votefst,
            votelst: params.votelst,
            // ARC-26 / native pera apps emit `votekd` (vote key dilution).
            // The legacy `votekdkey` form is kept as a fallback for old QR
            // codes that may have used the misspelled field.
            votekd: params.votekd ?? params.votekdkey,
            fee: params.fee,
            note: params.note,
            xnote: params.xnote,
        } as KeyregDeeplink
    }

    if (parsed.type === 'assetquery') {
        const { assetId, network } = parsed
        // Redirect to Pera Explorer
        const targetNetwork = network === 'testnet' ? 'testnet' : 'mainnet'
        const baseUrl = getNetworkConfig(targetNetwork).explorerUrl

        return {
            type: DeeplinkType.DISCOVER_BROWSER,
            sourceUrl: url,
            url: `${baseUrl}/asset/${assetId}/`,
        } as DiscoverBrowserDeeplink
    }

    if (parsed.type === 'appquery') {
        const { appId, network } = parsed
        // Redirect to Pera Explorer
        const targetNetwork = network === 'testnet' ? 'testnet' : 'mainnet'
        const baseUrl = getNetworkConfig(targetNetwork).explorerUrl

        return {
            type: DeeplinkType.DISCOVER_BROWSER,
            sourceUrl: url,
            url: `${baseUrl}/application/${appId}/`,
        } as DiscoverBrowserDeeplink
    }

    return null
}
