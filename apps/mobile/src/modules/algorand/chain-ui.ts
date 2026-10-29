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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type {
    AssetAboutParams,
    AssetAboutDisplay,
    CollectibleDetailsDisplay,
} from '@modules/assets'
import type { ChainUi } from '@modules/chain-ui'
import {
    AlgorandAccountSection,
    useHasAlgorandAccountSection,
} from './components/AlgorandAccountSection'
import { AlgorandCustomNodeForm } from './components/AlgorandCustomNodeForm'
import { AlgorandTransactionDetailBody } from './components/AlgorandTransactionDetailBody'
import { AlgorandTransactionPreviewRow } from './components/AlgorandTransactionPreviewRow'
import { AlgorandTransactionReviewBody } from './components/AlgorandTransactionReviewBody'
import { AlgorandSendNoteSection } from './components/AlgorandSendNoteSection'
import { AssetSecurityTags } from './components/AssetSecurityTags'
import { AssetVerificationCard } from './components/AssetVerificationCard'
import { FeeDisplay } from './components/FeeDisplay'
import { GroupTransactionsPanel } from './components/transaction-details/GroupTransactionsPanel'
import { useAlgorandTransactionDetail } from './hooks/useAlgorandTransactionDetail'

// ALGO's backend link points at Algoscan, which the descriptor's explorer builders can't express.
export const resolveAlgorandAssetAbout = ({
    asset,
    isNativeAsset,
}: AssetAboutParams): AssetAboutDisplay => {
    const explorerUrl = asset.peraMetadata?.explorerUrl
    return {
        idLabelKey: isNativeAsset
            ? null
            : i18nKey('asset_details.about.asa_id'),
        urlLabelKey: isNativeAsset
            ? i18nKey('asset_details.about.url')
            : i18nKey('asset_details.about.asa_url'),
        explorerLink: explorerUrl?.length
            ? {
                  url: explorerUrl,
                  label: isNativeAsset ? 'Algoscan' : 'Pera Explorer',
              }
            : null,
    }
}

export const algorandCollectibleDetailsDisplay: CollectibleDetailsDisplay = {
    identityLabelKey: i18nKey('asset_details.collectible.asset_id'),
    creatorLabelKey: i18nKey('asset_details.collectible.creator'),
    hasTotalSupply: true,
    explorerLabelKey: i18nKey('asset_details.collectible.explorer'),
}

export const algorandChainUi: ChainUi = {
    transactionDetails: {
        ReviewBody: AlgorandTransactionReviewBody,
        DetailBody: AlgorandTransactionDetailBody,
        PreviewRow: AlgorandTransactionPreviewRow,
        useTransactionDetail: useAlgorandTransactionDetail,
        RelatedTransactions: GroupTransactionsPanel,
        TotalFee: FeeDisplay,
    },
    assetDetails: {
        VerificationSection: AssetVerificationCard,
        IssuerControlsSection: AssetSecurityTags,
        resolveAbout: resolveAlgorandAssetAbout,
    },
    collectibleDetails: algorandCollectibleDetailsDisplay,
    sendConfirmation: {
        TrailingSection: AlgorandSendNoteSection,
    },
    customNode: {
        Form: AlgorandCustomNodeForm,
    },
    familyLabel: i18nKey('chain_families.algorand'),
    passphraseCompatibilityKey: i18nKey(
        'view_passphrase.compatibility.algorand',
    ),
    accountOptions: {
        ExpandedSection: AlgorandAccountSection,
        useHasExpandedSection: useHasAlgorandAccountSection,
    },
    watchAccountCopy: {
        optionDescriptionKey: i18nKey(
            'onboarding.add_account.watch_address_option_description',
        ),
        descriptionKey: i18nKey('onboarding.watch_account.description'),
        invalidAddressKey: i18nKey('onboarding.watch_account.invalid_address'),
    },
    addressSearchPlaceholder: i18nKey('address_entry.search_placeholder'),
    wrongNetworkAddress: {
        titleKey: i18nKey('address_entry.wrong_network.title.algorand'),
        bodyKey: i18nKey('address_entry.wrong_network.body.algorand'),
        sendBodyKey: i18nKey('address_entry.wrong_network.send_body.algorand'),
        sendOnNetworkBodyKey: i18nKey(
            'address_entry.wrong_network.send_body_on_network.algorand',
        ),
    },
}
