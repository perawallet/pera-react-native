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

import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    EMPTY_ALGORAND_HISTORY_DATA,
    type AlgorandHistoryData,
} from '../transactions/history-data'

export type AlgorandHistoryFacts = Partial<Omit<AlgorandHistoryData, 'family'>>

/** A history item written with the Algorand facts alongside the neutral ones. */
export type FlatHistoryItem = Omit<TransactionHistoryItem, 'chainData'> &
    AlgorandHistoryFacts

export const flatHistoryItem = ({
    groupId,
    closeTo,
    closeAmount,
    applicationId,
    innerTransactionCount,
    swapGroupDetail,
    ...item
}: FlatHistoryItem): TransactionHistoryItem => ({
    ...item,
    chainData: {
        ...EMPTY_ALGORAND_HISTORY_DATA,
        ...(groupId !== undefined && { groupId }),
        ...(closeTo !== undefined && { closeTo }),
        ...(closeAmount !== undefined && { closeAmount }),
        ...(applicationId !== undefined && { applicationId }),
        ...(innerTransactionCount !== undefined && { innerTransactionCount }),
        ...(swapGroupDetail !== undefined && { swapGroupDetail }),
    },
})
