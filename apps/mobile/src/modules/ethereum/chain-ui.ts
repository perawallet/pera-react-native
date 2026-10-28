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
import type { ChainUi } from '@modules/chain-ui'
import { EthereumTransactionDetailBody } from './components/EthereumTransactionDetailBody'
import { EthereumTransactionPreviewRow } from './components/EthereumTransactionPreviewRow'
import { EthereumTransactionReviewBody } from './components/EthereumTransactionReviewBody'
import { EthereumSendFeeSection } from './components/EthereumSendFeeSection'

// metro.config.js swaps this for the stub unless the baked CHAINS lists
// ethereum, which keeps viem out of an Algorand-only bundle.
export const ethereumChainUi: ChainUi | undefined = {
    familyLabel: i18nKey('chain_families.evm'),
    transactionDetails: {
        ReviewBody: EthereumTransactionReviewBody,
        DetailBody: EthereumTransactionDetailBody,
        PreviewRow: EthereumTransactionPreviewRow,
    },
    sendConfirmation: {
        FeeSection: EthereumSendFeeSection,
    },
    wrongNetworkAddress: {
        titleKey: i18nKey('address_entry.wrong_network.title.evm'),
        bodyKey: i18nKey('address_entry.wrong_network.body.evm'),
        sendBodyKey: i18nKey('address_entry.wrong_network.send_body.evm'),
        sendOnNetworkBodyKey: i18nKey(
            'address_entry.wrong_network.send_body_on_network.evm',
        ),
    },
}
