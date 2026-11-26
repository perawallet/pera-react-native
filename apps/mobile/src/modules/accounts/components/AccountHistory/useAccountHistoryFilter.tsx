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
import type { TransactionHistoryType } from '@perawallet/wallet-core-transactions'
import type { Nullable } from '@perawallet/wallet-core-shared'
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
    /** Null is All. */
    historyType: Nullable<TransactionHistoryType>
    /** Off by default: suspicious rows are left out; on, they show dimmed and badged. */
    isSuspiciousShown: boolean
    /** `chainId` is the network the analytics event names; `canFilterByType` shows the Type section. */
    openFilter: (chainId: ChainId, canFilterByType: boolean) => Promise<void>
}

export const useAccountHistoryFilter = (): UseAccountHistoryFilterResult => {
    const [activeFilter, setActiveFilter] = useState<TransactionFilter>(
        TransactionFilter.AllTime,
    )
    const [customRange, setCustomRange] = useState<CustomDateRange>()
    const [historyType, setHistoryType] =
        useState<Nullable<TransactionHistoryType>>(null)
    const [isSuspiciousShown, setIsSuspiciousShown] = useState(false)
    const { request: requestBottomSheet } = useBottomSheet()

    const { afterTime, beforeTime } = useMemo(
        () => getFilterTimes(activeFilter, customRange),
        [activeFilter, customRange],
    )

    const openFilter = useCallback(
        async (chainId: ChainId, canFilterByType: boolean) => {
            const result = await requestBottomSheet<TransactionsFilterResult>({
                contents: (
                    <TransactionsFilterContent
                        activeFilter={activeFilter}
                        initialCustomRange={customRange}
                        activeHistoryType={
                            canFilterByType ? historyType : undefined
                        }
                        isSuspiciousShown={isSuspiciousShown}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!result) return
            // Sent on apply rather than open, so it carries what was picked.
            trackEvent(AccountDetailsEvent.TransactionFilter, {
                [AnalyticsMetadataKey.ChainId]: chainId,
                ...(result.historyType !== undefined && {
                    [AnalyticsMetadataKey.TransactionType]:
                        result.historyType ?? 'all',
                }),
            })
            setActiveFilter(result.filter)
            if (result.customRange) {
                setCustomRange(result.customRange)
            }
            if (result.historyType !== undefined) {
                setHistoryType(result.historyType)
            }
            if (result.isSuspiciousShown !== undefined) {
                setIsSuspiciousShown(result.isSuspiciousShown)
            }
        },
        [
            requestBottomSheet,
            activeFilter,
            customRange,
            historyType,
            isSuspiciousShown,
        ],
    )

    return {
        activeFilter,
        customRange,
        afterTime,
        beforeTime,
        historyType,
        isSuspiciousShown,
        openFilter,
    }
}
