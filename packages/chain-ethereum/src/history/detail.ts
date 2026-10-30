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

import type { Decimal } from 'decimal.js'
import { isHash, TransactionNotFoundError } from 'viem'
import type {
    ChainContext,
    ChainScope,
    TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import { ethereumMinedViewOf } from '../signing/review'
import { toEthereumNative } from '../signing/transaction-view'

/**
 * The transaction as the node holds it, read for a detail screen: the
 * calldata is what the history row lacks. Null when the node has no such
 * transaction (pruned, or not on this network); every other failure rejects.
 */
export const readEvmTransactionDetail = async (
    ctx: ChainContext,
    chain: EvmChain,
    scope: ChainScope,
    txId: string,
    feePaid?: Decimal,
): Promise<Nullable<TransactionNative>> => {
    // A withdrawal's id is not a hash, and there is no transaction to read for it.
    if (!isHash(txId)) return null
    const client = createEvmClient(scope, ctx, chain)
    try {
        const tx = await client.getTransaction({ hash: txId })
        return toEthereumNative(
            ethereumMinedViewOf(
                {
                    from: tx.from,
                    to: tx.to ?? undefined,
                    data: tx.input,
                    value: tx.value,
                },
                feePaid,
            ),
        )
    } catch (error) {
        if (error instanceof TransactionNotFoundError) return null
        throw error
    }
}
