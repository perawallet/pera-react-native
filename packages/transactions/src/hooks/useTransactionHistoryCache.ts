/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { upsertTransactions, getTransactionHistory } from '../db'
import type { TransactionHistoryItem } from '../models/types'

export const getCachedTransactionHistory = (params: {
    accountAddress: string
    network: string
    assetId?: string
    limit?: number
}): TransactionHistoryItem[] => {
    try {
        return getTransactionHistory(params)
    } catch (error) {
        logger.warn('Failed to read cached transactions from database', {
            error,
        })
        return []
    }
}

export const persistTransactions = (
    items: TransactionHistoryItem[],
    accountAddress: string,
    network: string,
): void => {
    try {
        upsertTransactions({ items, accountAddress, network })
    } catch (error) {
        logger.warn('Failed to persist transactions to database', { error })
    }
}

export const useTransactionsCacheSync = (
    transactions: TransactionHistoryItem[],
    isFetched: boolean,
    accountAddress: string,
    network: string,
): void => {
    useEffect(() => {
        if (isFetched && transactions.length > 0) {
            persistTransactions(transactions, accountAddress, network)
        }
    }, [transactions, isFetched, accountAddress, network])
}
