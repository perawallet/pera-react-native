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
import { useInfiniteQuery, onlineManager } from '@tanstack/react-query'
import type {
    ChainScope,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'
import {
    isoDateToUnixSeconds,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    getPendingTransactionRecords,
    getTransactionHistoryWithPending,
} from '../pending-history'
import { transactionQueryKeys } from './querykeys'

export type UseTransactionRecordsQueryParams = {
    accountAddress: string
    scope: ChainScope
    /** Kept client-side: the records backends take no asset filter. */
    assetId?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    beforeTime?: string
    isEnabled?: boolean
}

export type UseTransactionRecordsQueryResult = {
    /** Newest first, across every loaded page. */
    records: TransactionRecord[]
    isLoading: boolean
    /** See `UseTransactionHistoryQueryResult.isFetched`. */
    isFetched: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

type RecordsPage = {
    records: TransactionRecord[]
    next: Nullable<PageRef>
}

const involvesAsset = (record: TransactionRecord, assetId: string): boolean =>
    record.summary.amount?.assetRef.assetId === assetId ||
    (record.summary.balanceChanges ?? []).some(
        change => change.assetRef.assetId === assetId,
    )

const unixMsOf = (isoDate?: string): Optional<number> => {
    const seconds = isoDateToUnixSeconds(isoDate)
    return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/**
 * History for a chain that keeps no cached rows (see `hasCachedHistoryRows`),
 * read page by page from the chain's `getTransactionHistory` with the wallet's
 * own broadcasts merged into page one.
 */
export const useTransactionRecordsQuery = ({
    accountAddress,
    scope,
    assetId,
    afterTime,
    beforeTime,
    isEnabled = true,
}: UseTransactionRecordsQueryParams): UseTransactionRecordsQueryResult => {
    const fromMs = unixMsOf(afterTime)
    const beforeDayMs = unixMsOf(beforeTime)
    const untilMs =
        beforeDayMs === undefined
            ? undefined
            : beforeDayMs + SECONDS_PER_DAY * 1000

    // A record with no timestamp hasn't been mined, so no date range rules it out.
    const isKept = (record: TransactionRecord): boolean =>
        (assetId === undefined || involvesAsset(record, assetId)) &&
        (record.timestamp === undefined ||
            ((fromMs === undefined || record.timestamp >= fromMs) &&
                (untilMs === undefined || record.timestamp < untilMs)))

    const query = useInfiniteQuery({
        queryKey: transactionQueryKeys.records(accountAddress, scope, {
            assetId,
            afterTime,
            beforeTime,
        }),
        queryFn: async ({
            pageParam,
            signal,
        }: {
            pageParam: Nullable<PageRef>
            signal: AbortSignal
        }): Promise<RecordsPage> => {
            // networkMode 'always' lets this run offline, where the ledger's
            // own sends are all there is to show.
            if (!onlineManager.isOnline()) {
                const pending =
                    pageParam === null
                        ? await getPendingTransactionRecords({
                              address: accountAddress,
                              scope,
                              listedIds: new Set(),
                          })
                        : []
                return { records: pending.filter(isKept), next: null }
            }

            // A backend page can be empty and still have a next one, and a
            // filtered page often is: an empty page would park the list on
            // its skeleton with nothing on screen to scroll, so keep reading.
            let page = pageParam ?? undefined
            for (;;) {
                signal.throwIfAborted()
                const { items, next } = await getTransactionHistoryWithPending(
                    accountAddress,
                    scope,
                    page,
                )
                const isPastRange =
                    fromMs !== undefined &&
                    items.some(
                        record =>
                            record.timestamp !== undefined &&
                            record.timestamp < fromMs,
                    )
                const records = items.filter(isKept)
                const nextPage = isPastRange ? undefined : next
                if (records.length > 0 || !nextPage) {
                    return { records, next: nextPage ?? null }
                }
                page = nextPage
            }
        },
        initialPageParam: null as Nullable<PageRef>,
        getNextPageParam: (lastPage: RecordsPage) => lastPage.next ?? undefined,
        networkMode: 'always',
        enabled: isEnabled && !!accountAddress,
    })

    const records = useMemo(
        () => query.data?.pages.flatMap(page => page.records) ?? [],
        [query.data],
    )

    return {
        records,
        isLoading: query.isLoading,
        isFetched: query.isFetched,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        error: query.error,
        hasNextPage: query.hasNextPage,
        fetchNextPage: () => void query.fetchNextPage(),
        refetch: () => void query.refetch(),
    }
}
