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

import {
    i18nKey,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    extractDomain,
    resolveTotalSupply,
    type AssetAboutDisplay,
    type AssetDisplayParams,
    type AssetSupplyDisplay,
} from '@modules/assets'
import type { ChainUi, ChainUiOverride } from '@modules/chain-ui'
import { EthereumRecordDetailBody } from './components/EthereumRecordDetailBody'
import { EthereumTransactionDetailBody } from './components/EthereumTransactionDetailBody'
import { EthereumTransactionPreviewRow } from './components/EthereumTransactionPreviewRow'
import { EthereumTransactionReviewBody } from './components/EthereumTransactionReviewBody'
import { EthereumSendFeeSection } from './components/EthereumSendFeeSection'

export const resolveEthereumAssetAbout = ({
    asset,
    scope,
    descriptor,
    isNativeAsset,
}: AssetDisplayParams): AssetAboutDisplay => {
    const url = isNativeAsset
        ? descriptor.explorer.homeUrl?.(scope.networkId)
        : descriptor.explorer.assetUrl(scope.networkId, asset.assetId)
    return {
        idLabelKey: isNativeAsset
            ? null
            : i18nKey('asset_details.collectible.contract'),
        urlLabelKey: i18nKey('asset_details.about.url'),
        explorerLink: url ? { url, label: extractDomain(url) } : null,
    }
}

export const resolveEthereumAssetSupply = (
    params: AssetDisplayParams,
): AssetSupplyDisplay => {
    if (params.isNativeAsset) {
        return {
            labelKey: i18nKey('asset_details.markets.circulating_supply'),
            infoBodyKey: i18nKey(
                'asset_details.markets.circulating_supply_info_body',
            ),
            // A native coin has no contract, so no total supply; its circulating supply is market data.
            amount: null,
        }
    }
    return {
        ...resolveTotalSupply(params),
        infoBodyKey: i18nKey(
            'asset_details.markets.token_total_supply_info_body',
        ),
    }
}

// metro.config.js swaps this for the stub unless the baked CHAINS lists
// ethereum, which keeps viem out of an Algorand-only bundle.
export const ethereumChainUi: Optional<ChainUi> = {
    familyLabel: i18nKey('chain_families.evm'),
    passphraseCompatibilityKey: i18nKey('view_passphrase.compatibility.evm'),
    transactionDetails: {
        ReviewBody: EthereumTransactionReviewBody,
        DetailBody: EthereumTransactionDetailBody,
        RecordDetailBody: EthereumRecordDetailBody,
        PreviewRow: EthereumTransactionPreviewRow,
    },
    sendConfirmation: {
        FeeSection: EthereumSendFeeSection,
    },
    assetDetails: {
        resolveAbout: resolveEthereumAssetAbout,
        resolveSupply: resolveEthereumAssetSupply,
    },
    addressSearchPlaceholder: i18nKey('address_entry.search_placeholder_evm'),
    wrongNetworkAddress: {
        titleKey: i18nKey('address_entry.wrong_network.title.evm'),
        bodyKey: i18nKey('address_entry.wrong_network.body.evm'),
        sendBodyKey: i18nKey('address_entry.wrong_network.send_body.evm'),
        sendOnNetworkBodyKey: i18nKey(
            'address_entry.wrong_network.send_body_on_network.evm',
        ),
    },
}

// A chain whose UI differs from the EVM family's adds its slots here, so
// metro's stub drops them along with the family's.
export const evmChainUiOverrides: Optional<
    Partial<Record<EvmChainId, ChainUiOverride>>
> = {}
