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
import { DeeplinkType, type AnyParsedDeeplink } from './links'
import type { ChainDeeplinkIntent } from './models'
import { parseWalletConnectDeeplink } from './wallet-connect'

export const linkFromIntent = (
    intent: ChainDeeplinkIntent,
    sourceUrl: string,
): Nullable<AnyParsedDeeplink> => {
    switch (intent.kind) {
        case 'address': {
            return {
                type: DeeplinkType.ADDRESS_ACTIONS,
                sourceUrl,
                target: intent.target,
                address: intent.address,
                label: intent.label,
            }
        }
        case 'payment': {
            return {
                type: DeeplinkType.TRANSFER,
                sourceUrl,
                target: intent.target,
                receiverAddress: intent.recipient,
                assetRef: intent.assetRef,
                amount: intent.amount,
                note: intent.note,
                label: intent.label,
                chainData: intent.chainData,
            }
        }
        case 'asset-opt-in': {
            return {
                type: DeeplinkType.ASSET_OPT_IN,
                sourceUrl,
                target: intent.target,
                assetRef: intent.assetRef,
                address: intent.address,
            }
        }
        case 'explorer': {
            return {
                type: DeeplinkType.DISCOVER_BROWSER,
                sourceUrl,
                url: intent.url,
                target: intent.target,
            }
        }
        case 'wallet-connect': {
            return parseWalletConnectDeeplink(intent.uri, sourceUrl)
        }
        case 'chain-action': {
            return {
                type: DeeplinkType.CHAIN_ACTION,
                sourceUrl,
                target: intent.target,
                chainData: intent.chainData,
            }
        }
    }
}
