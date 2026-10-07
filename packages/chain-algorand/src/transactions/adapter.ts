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

import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../legacy-network'
import type {
    HistoryChainAdapter,
    SendFlowChainAdapter,
} from '@perawallet/wallet-core-transactions'
import { algorandAssetInbox } from '../asa-inbox/adapter'
import { fetchIndexerCloseAmount } from './history/indexer/endpoints'
import { fetchMoreTransactions, fetchTransactionHistory } from './history'
import { resolveAlgorandAssetFacts } from './history/assetFacts'
import { mapHistoryItemToDisplayableTransaction } from './mapHistoryItemToDisplayableTransaction'
import {
    buildExpressTransferTxs,
    buildKeyRegistrationTx,
    buildOptInTxs,
    buildOptOutTxs,
    buildRekeyTx,
    buildTransferTxs,
} from './builders'

export const algorandSendFlowAdapter: SendFlowChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    buildTransferTxs,
    express: { buildTxs: buildExpressTransferTxs },
    assetInbox: algorandAssetInbox,
    assetHolding: { buildOptInTxs, buildOptOutTxs },
    rekey: { buildTx: buildRekeyTx },
    keyRegistration: { buildTx: buildKeyRegistrationTx },
}

export const algorandHistoryAdapter: HistoryChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    fetchHistory: async ({ scope, ...params }) =>
        fetchTransactionHistory({
            ...params,
            network: algorandNetworkOf(scope),
        }),
    fetchMoreHistory: async ({ scope, ...params }) =>
        fetchMoreTransactions({ ...params, network: algorandNetworkOf(scope) }),
    fetchCloseAmount: async (txId, scope) =>
        fetchIndexerCloseAmount(txId, algorandNetworkOf(scope)),
    toDisplayable: mapHistoryItemToDisplayableTransaction,
    resolveAssetFacts: resolveAlgorandAssetFacts,
}
