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
    TransferChainAdapter,
} from '@perawallet/wallet-core-transactions'
import { algorandAssetInbox } from '../asa-inbox/adapter'
import { fetchIndexerCloseAmount } from './history/indexer/endpoints'
import { fetchMoreTransactions, fetchTransactionHistory } from './history'
import { resolveAlgorandAssetFacts } from './history/assetFacts'
import { getAlgorandTransactionHistory } from './history-records'
import { mapHistoryItemToDisplayableTransaction } from './mapHistoryItemToDisplayableTransaction'
import {
    buildExpressTransferTxs,
    buildDecodedKeyRegistrationTx,
    buildOptInTxs,
    buildOptOutTxs,
    buildRekeyTx,
    buildTransferTxs,
} from './builders'
import { summarizeAlgorandHistoryItem } from './summarize'
import { buildAlgorandTransfer } from './transfer-builder'
import { estimateAlgorandTransferFee } from './transfer-fees'
import {
    payloadTransactionsOf,
    wrapsAlgorandGroup,
    wrapsAlgorandTransaction,
} from '../signing/unsignedAlgorandTransactions'
import {
    algorandHoldingReserve,
    readAlgorandRecipientWarning,
    readAlgorandSpendableBalance,
} from './spendable-balance'

export const algorandSendFlowAdapter: SendFlowChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    buildTransferTxs: wrapsAlgorandGroup(buildTransferTxs),
    totalFee: transactions =>
        payloadTransactionsOf(transactions).reduce(
            (total, transaction) => total + (transaction.fee ?? 0n),
            0n,
        ),
    express: { buildTxs: wrapsAlgorandGroup(buildExpressTransferTxs) },
    assetInbox: {
        ...algorandAssetInbox,
        buildSendTxs: wrapsAlgorandGroup(algorandAssetInbox.buildSendTxs),
        buildClaimTxs: wrapsAlgorandGroup(algorandAssetInbox.buildClaimTxs),
        buildRejectTxs: wrapsAlgorandGroup(algorandAssetInbox.buildRejectTxs),
    },
    assetHolding: {
        buildOptInTxs: wrapsAlgorandGroup(buildOptInTxs),
        buildOptOutTxs: wrapsAlgorandGroup(buildOptOutTxs),
    },
    rekey: { buildTx: wrapsAlgorandTransaction(buildRekeyTx) },
    keyRegistration: {
        buildTx: wrapsAlgorandTransaction(buildDecodedKeyRegistrationTx),
    },
}

export const algorandTransferAdapter: TransferChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    build: buildAlgorandTransfer,
    getFeeEstimate: estimateAlgorandTransferFee,
    spendableBalance: readAlgorandSpendableBalance,
    recipientWarning: readAlgorandRecipientWarning,
    holdingReserve: algorandHoldingReserve,
}

export const algorandHistoryAdapter = {
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
    getTransactionHistory: getAlgorandTransactionHistory,
    summarize: summarizeAlgorandHistoryItem,
    toDisplayable: mapHistoryItemToDisplayableTransaction,
    resolveAssetFacts: resolveAlgorandAssetFacts,
} satisfies HistoryChainAdapter
