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

import { useCallback, useMemo, useState } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    trackEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    TransactionFilter,
    TransactionsFilterContent,
    type CustomDateRange,
    type TransactionsFilterResult,
} from '../TransactionsFilterContent'
import { getFilterTimes } from './utils'

export type UseAccountHistoryFilterResult = {
    activeFilter: TransactionFilter
    customRange?: CustomDateRange
    /** `YYYY-MM-DD`, inclusive. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive. */
    beforeTime?: string
    /** `chainId` is the network the analytics event names. */
    openFilter: (chainId: ChainId) => Promise<void>
}

export const useAccountHistoryFilter = (): UseAccountHistoryFilterResult => {
    const [activeFilter, setActiveFilter] = useState<TransactionFilter>(
        TransactionFilter.AllTime,
    )
    const [customRange, setCustomRange] = useState<CustomDateRange>()
    const { request: requestBottomSheet } = useBottomSheet()

    const { afterTime, beforeTime } = useMemo(
        () => getFilterTimes(activeFilter, customRange),
        [activeFilter, customRange],
    )

    const openFilter = useCallback(
        async (chainId: ChainId) => {
            trackEvent(AccountDetailsEvent.TransactionFilter, {
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
            const result = await requestBottomSheet<TransactionsFilterResult>({
                contents: (
                    <TransactionsFilterContent
                        activeFilter={activeFilter}
                        initialCustomRange={customRange}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!result) return
            setActiveFilter(result.filter)
            if (result.customRange) {
                setCustomRange(result.customRange)
            }
        },
        [requestBottomSheet, activeFilter, customRange],
    )

    return { activeFilter, customRange, afterTime, beforeTime, openFilter }
}
