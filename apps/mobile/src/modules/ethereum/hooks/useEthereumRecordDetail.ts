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

import { useMemo } from 'react'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import type {
    TransactionNative,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { readEthereumNative } from '@perawallet/wallet-core-chain-ethereum'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useTransactionRecordDetailQuery } from '@perawallet/wallet-core-transactions'
import { isEvmTransactionHash } from '../utils/isEvmTransactionHash'

export type UseEthereumRecordDetailResult = {
    /** The node's decoded transaction; null until read, when decoding is off, the record has nothing to read, or the read decodes nothing the record doesn't say. */
    transaction: Nullable<TransactionNative>
    isLoading: boolean
    /** Decoding is on and the node's copy couldn't be read, offline or pruned. */
    isReadFailed: boolean
    isDecoding: boolean
}

const isInformative = (
    transaction: Optional<TransactionNative>,
): transaction is TransactionNative => {
    if (!transaction) return false
    try {
        const view = readEthereumNative(transaction)
        return view.kind !== 'contract-call' || !!view.call
    } catch {
        return false
    }
}

/**
 * The calldata a history row lacks is read from the node only while
 * `contractDecoding` is on, and only for a mined call one of the wallet's own
 * accounts made: a withdrawal or a pending send has none to read, a plain
 * value transfer has no calldata, and the decoded view of someone else's call
 * (a payment received, an approval naming this account as spender, a
 * `transferFrom` pulling its tokens) would read as the account's own act. The
 * decoded view is returned only when it says more than the record: a decoded
 * standard call, or a transaction that isn't a contract call.
 */
export const useEthereumRecordDetail = (
    record: TransactionRecord,
): UseEthereumRecordDetailResult => {
    const isDecoding = useChainCapability(
        record.scope.chainId,
        'contractDecoding',
    )
    const initiator = useFindAccountByAddress(
        record.initiator ?? '',
        record.scope,
    )
    const isReadable =
        isDecoding &&
        isEvmTransactionHash(record.id) &&
        !!initiator &&
        record.summary.kind !== 'transfer' &&
        (record.status === 'confirmed' || record.status === 'failed')
    const query = useTransactionRecordDetailQuery({
        scope: record.scope,
        transactionId: record.id,
        record,
        isEnabled: isReadable,
    })

    return useMemo(
        () => ({
            transaction:
                isReadable && isInformative(query.data) ? query.data : null,
            isLoading: isReadable && query.isLoading,
            isReadFailed:
                isReadable && !query.data && (query.isError || query.isPaused),
            isDecoding,
        }),
        [
            isReadable,
            isDecoding,
            query.data,
            query.isLoading,
            query.isError,
            query.isPaused,
        ],
    )
}
