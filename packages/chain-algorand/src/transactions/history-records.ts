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

import type {
    ChainScope,
    Page,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { algorandNetworkOf } from '../network-id'
import { fetchMoreTransactions, fetchTransactionHistory } from './history'
import { algorandHistoryDataOf } from './history-data'
import { summarizeAlgorandHistoryItem } from './summarize'

const toAlgorandTransactionRecord = (
    item: TransactionHistoryItem,
    address: string,
    scope: ChainScope,
): TransactionRecord => {
    const data = algorandHistoryDataOf(item)
    return {
        id: item.id,
        scope,
        status: item.status ?? 'confirmed',
        timestamp: item.roundTime > 0 ? item.roundTime * 1000 : undefined,
        fee: item.fee,
        initiator: item.sender,
        summary: summarizeAlgorandHistoryItem(item, address),
        chainData: {
            family: 'algorand',
            groupId: data.groupId ?? undefined,
            closeRemainderTo: data.closeTo ?? undefined,
        },
    }
}

export const getAlgorandTransactionHistory = async (
    address: string,
    scope: ChainScope,
    page?: PageRef,
): Promise<Page<TransactionRecord>> => {
    const network = algorandNetworkOf(scope)
    const { transactions, pagination } = page
        ? await fetchMoreTransactions({
              url: page.cursor,
              network,
              accountAddress: address,
              limit: page.limit,
          })
        : await fetchTransactionHistory({
              accountAddress: address,
              network,
          })

    return {
        items: transactions.map(item =>
            toAlgorandTransactionRecord(item, address, scope),
        ),
        ...(pagination.hasNextPage &&
            pagination.nextUrl && { next: { cursor: pagination.nextUrl } }),
    }
}
