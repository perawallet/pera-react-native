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

import { Decimal } from 'decimal.js'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { readAlgorandTransaction } from '../signing/planner'
import {
    toUnsignedAlgorandTransaction,
    toUnsignedAlgorandTransactions,
} from '../signing/unsignedTransaction'
import { algorandNetworkOf } from '../network-id'
import type {
    HistoryChainAdapter,
    SendFlowChainAdapter,
    TransferChainAdapter,
} from '@perawallet/wallet-core-transactions'
import { algorandAssetInbox } from '../asa-inbox/adapter'
import { getAlgorandAddressPoisoningRules } from './address-poisoning'
import { fetchMoreTransactions, fetchTransactionHistory } from './history'
import { resolveAlgorandAssetFacts } from './history/assetFacts'
import { getAlgorandTransactionHistory } from './history-records'
import {
    algorandHistoryChainData,
    healAlgorandCachedRows,
} from './history-cache'
import { algorandGroupToOpen } from './history-data'
import { mapHistoryItemToTransactionNative } from './history-transaction'
import {
    buildExpressTransferTxs,
    buildOptInTxs,
    buildOptOutTxs,
    buildRekeyTx,
    buildTransferTxs,
} from './builders'
import { summarizeAlgorandHistoryItem } from './summarize'
import { buildAlgorandTransfer } from './transfer-builder'
import { estimateAlgorandTransferFee } from './transfer-fees'
import {
    algorandHoldingReserve,
    readAlgorandRecipientWarning,
    readAlgorandSpendableBalance,
} from './spendable-balance'

export const algorandSendFlowAdapter: SendFlowChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    buildTransferTxs: async params =>
        toUnsignedAlgorandTransactions(
            await buildTransferTxs(params),
            params.scope,
        ),
    express: {
        buildTxs: async params =>
            toUnsignedAlgorandTransactions(
                await buildExpressTransferTxs(params),
                params.scope,
            ),
    },
    assetInbox: algorandAssetInbox,
    assetHolding: {
        buildOptInTxs: async params =>
            toUnsignedAlgorandTransactions(
                await buildOptInTxs(params),
                params.scope,
            ),
        buildOptOutTxs: async params =>
            toUnsignedAlgorandTransactions(
                await buildOptOutTxs(params),
                params.scope,
            ),
    },
    delegation: {
        buildTx: async params =>
            toUnsignedAlgorandTransaction(
                await buildRekeyTx(params),
                params.scope,
            ),
    },
    transactionFee: transaction =>
        new Decimal(
            readAlgorandTransaction(transaction).transaction.fee.toString(),
        ),
}

export const algorandTransferAdapter: TransferChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    build: buildAlgorandTransfer,
    getFeeEstimate: estimateAlgorandTransferFee,
    spendableBalance: readAlgorandSpendableBalance,
    recipientWarning: readAlgorandRecipientWarning,
    holdingReserve: algorandHoldingReserve,
    addressPoisoning: getAlgorandAddressPoisoningRules,
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
    getTransactionHistory: getAlgorandTransactionHistory,
    summarize: summarizeAlgorandHistoryItem,
    groupToOpen: algorandGroupToOpen,
    toTransactionNative: mapHistoryItemToTransactionNative,
    resolveAssetFacts: resolveAlgorandAssetFacts,
    chainData: algorandHistoryChainData,
    healCachedRows: healAlgorandCachedRows,
} satisfies HistoryChainAdapter
