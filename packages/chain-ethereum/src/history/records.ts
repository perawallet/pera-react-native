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
import type {
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../chains/types'
import type { EvmHistoryItem } from './api/schema'
import { singleNftOf, summarizeEthereumHistoryItem } from './summarize'

// A withdrawal row has no hash; its first EIP-4895 index is unique
// chain-wide. Explorer links must special-case these ids.
export const evmHistoryRecordId = (item: EvmHistoryItem): Optional<string> =>
    item.kind === 'withdrawal'
        ? item.withdrawals[0] && `withdrawal:${item.withdrawals[0].index}`
        : (item.hash ?? undefined)

export const toEvmHistoryRecords = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
    isDecoding: boolean,
    nftApprovals: ReadonlySet<string>,
): TransactionRecord[] => {
    const id = evmHistoryRecordId(item)
    if (id === undefined) return []
    const summary = summarizeEthereumHistoryItem(
        item,
        address,
        scope,
        chain,
        isDecoding,
        nftApprovals,
    )
    const nft = singleNftOf(item, address, summary)
    return [
        {
            id,
            scope,
            status: item.status === 'success' ? 'confirmed' : 'failed',
            timestamp: Date.parse(item.block_time),
            ...(item.block_number !== undefined && {
                blockNumber: item.block_number,
            }),
            // No `from` means the row is known only from a transfer log. Read
            // unfiltered, another address signed it and the gas was never this
            // account's; an ERC-20 view names no sender on any row, so there
            // the account's own sends lose their fee and initiator too.
            fee:
                item.fee === null || item.from === null
                    ? undefined
                    : new Decimal(item.fee),
            ...(item.from !== null && { initiator: item.from }),
            summary,
            chainData: { family: 'evm', ...(nft && { nft }) },
        },
    ]
}
