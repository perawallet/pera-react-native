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
import {
    upsertAccountHoldings,
    getAccountHoldings,
    type HoldingRow,
} from '../db'

export const getCachedHoldings = async (
    accountAddress: string,
    network: string,
): Promise<HoldingRow[]> => {
    try {
        return await getAccountHoldings({ accountAddress, network })
    } catch (error) {
        logger.warn('Failed to read cached holdings from database', { error })
        return []
    }
}

export const persistHoldings = async (
    accountAddress: string,
    holdings: HoldingRow[],
    network: string,
): Promise<void> => {
    try {
        await upsertAccountHoldings({ accountAddress, holdings, network })
    } catch (error) {
        logger.warn('Failed to persist holdings to database', { error })
    }
}

export const useHoldingsCacheSync = (
    accountAddress: string,
    holdings: Array<{
        assetId: string | number
        amount: string | number | bigint
    }>,
    isFetched: boolean,
    network: string,
): void => {
    useEffect(() => {
        if (isFetched && holdings.length > 0) {
            const rows: HoldingRow[] = holdings.map(h => ({
                assetId: `${h.assetId}`,
                amount: `${h.amount}`,
            }))

            void persistHoldings(accountAddress, rows, network)
        }
    }, [accountAddress, holdings, isFetched, network])
}
