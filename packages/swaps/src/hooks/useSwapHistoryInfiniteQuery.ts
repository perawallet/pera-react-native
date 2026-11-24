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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    fetchSwapHistory,
    readForOwnedAccounts,
    type SwapHistoryPage,
} from '../api'
import type {
    SwapAccountAddressOnDevice,
    SwapHistoryItem,
    SwapStatus,
} from '../models'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
import { isAccountNotOnDeviceError } from '../utils/routerErrors'
import {
    mergeSwapHistoryPages,
    nextSwapHistoryCursors,
    swapHistoryBatchesOf,
    type SwapHistoryBatch,
    type SwapHistoryBatchPage,
    type SwapHistoryCursor,
} from '../utils/swapHistoryBatches'
import { swapQueryKeys } from './querykeys'

const PAGE_SIZE = 20
// Bounds the read-ahead over pages the status filter empties, so a history of
// only hidden rows can't loop the query forever.
const MAX_SKIPPED_PAGES = 10
// Device registration retries only on reconnect and foreground, so its id can
// stay missing; past this the read reports an error rather than loading forever.
const DEVICE_ID_WAIT_MS = 10_000

export type UseSwapHistoryInfiniteQueryResult = {
    swaps: SwapHistoryItem[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    /** None of the accounts is on this device, so the router has no history to give. */
    isAccountNotOnDevice: boolean
    /** A batch failed to load, so rows may be missing even when the rest loaded. */
    hasFailedBatch: boolean
    /** Names the accounts actually read; changes when that set does, e.g. once a device id registers. */
    readKey: string
    error: Nullable<Error>
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

type PageCursor = { cursor: string; accounts: string[] }

type RawPage = SwapHistoryPage & { accounts: string[] }

const exhaustedPage = (
    accounts: string[],
    failed = false,
): SwapHistoryBatchPage => ({
    accounts,
    results: [],
    next: null,
    oldestCreatedAt: null,
    ...(failed ? { failed: true } : {}),
})

const visibleOf = (
    page: RawPage,
    statuses: Optional<SwapStatus[]>,
): SwapHistoryBatchPage => ({
    accounts: page.accounts,
    results: page.results.filter(
        item =>
            isSwapHistoryRow(item) &&
            (!statuses || statuses.includes(item.status)),
    ),
    next: page.next,
    oldestCreatedAt: page.results.at(-1)?.createdAt ?? null,
})

const fetchVisiblePage = async (
    fetchPage: (param: Optional<PageCursor>) => Promise<RawPage>,
    statuses: Optional<SwapStatus[]>,
    param: Optional<PageCursor>,
): Promise<SwapHistoryBatchPage> => {
    let page = await fetchPage(param)
    for (let skipped = 0; skipped < MAX_SKIPPED_PAGES; skipped++) {
        const visible = visibleOf(page, statuses)
        if (visible.results.length > 0 || page.next === null) return visible
        page = await fetchPage({ cursor: page.next, accounts: page.accounts })
    }
    return visibleOf(page, statuses)
}

/**
 * The router has no status filter, so `statuses` narrows each page, reading
 * ahead past pages it empties. Accounts are read in batches, one request per
 * batch and page, because they travel in the URL; each batch pages on its own
 * cursor, and the pages are merged newest first. An order whose legs sit on
 * two accounts of one batch shows once. An account the device doesn't hold is
 * left out rather than failing the others: up front when registration doesn't
 * send it, and after the router refuses it otherwise. A batch that fails any
 * other way is left out the same way.
 */
export const useSwapHistoryInfiniteQuery = (
    accounts: SwapAccountAddressOnDevice[],
    statuses?: SwapStatus[],
    isEnabled: boolean = true,
): UseSwapHistoryInfiniteQueryResult => {
    const onDevice = useMemo(
        () =>
            accounts
                .filter(account => account.isOnDevice)
                .map(({ scope, address }) => ({ scope, address })),
        [accounts],
    )
    const deviceIdOf = useDeviceIdLookup()
    const allBatches = useMemo(() => swapHistoryBatchesOf(onDevice), [onDevice])
    // A deployment the device isn't registered on has no history to read. Keying
    // on the readable batches re-reads once its id registers.
    const batches = useMemo(
        () => allBatches.filter(batch => !!deviceIdOf(batch.deployment)),
        [allBatches, deviceIdOf],
    )
    const readable = useMemo(
        () =>
            batches.flatMap(batch =>
                batch.accounts.map(({ scope, address }) => ({
                    scope,
                    address,
                })),
            ),
        [batches],
    )
    const readKey = useMemo(
        () =>
            readable
                .map(({ scope, address }) => `${toScopeKey(scope)}|${address}`)
                .join(','),
        [readable],
    )
    // Accounts the router could hold history for, but no device id yet to ask with.
    const isWaitingForDeviceId =
        isEnabled && allBatches.length > 0 && batches.length === 0
    const [hasWaitedOut, setHasWaitedOut] = useState(false)
    useEffect(() => {
        if (!isWaitingForDeviceId) {
            setHasWaitedOut(false)
            return
        }
        const timer = setTimeout(() => setHasWaitedOut(true), DEVICE_ID_WAIT_MS)
        return () => clearTimeout(timer)
    }, [isWaitingForDeviceId])

    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.historyInfinite(readable, statuses),
        queryFn: async ({
            pageParam,
        }: {
            pageParam: Optional<SwapHistoryCursor[]>
        }): Promise<SwapHistoryBatchPage[]> => {
            const fetchBatch = (
                batch: SwapHistoryBatch,
                param: Optional<PageCursor>,
            ): Promise<SwapHistoryBatchPage> => {
                const deviceId = deviceIdOf(batch.deployment) ?? ''
                const read = (
                    routerIds: string[],
                    cursor: Optional<string>,
                    limit: number = PAGE_SIZE,
                ) =>
                    fetchSwapHistory(
                        { deviceId, accounts: routerIds, cursor, limit },
                        batch.scope,
                    )
                const fetchPage = async (
                    at: Optional<PageCursor>,
                ): Promise<RawPage> => {
                    if (at) {
                        const page = await read(at.accounts, at.cursor)
                        return { ...page, accounts: at.accounts }
                    }
                    const { value, accounts: owned } =
                        await readForOwnedAccounts(
                            batch.accounts.map(account => account.routerId),
                            (routerIds, limit) =>
                                read(routerIds, undefined, limit),
                        )
                    return { ...value, accounts: owned }
                }
                return fetchVisiblePage(fetchPage, statuses, param)
            }

            if (pageParam) {
                return Promise.all(
                    batches.map((batch, index) => {
                        const { accounts: bound, cursor } = pageParam[index]
                        return cursor === null
                            ? exhaustedPage(bound)
                            : fetchBatch(batch, { cursor, accounts: bound })
                    }),
                )
            }

            const settled = await Promise.allSettled(
                batches.map(batch => fetchBatch(batch, undefined)),
            )
            const failures = settled.filter(
                (result): result is PromiseRejectedResult =>
                    result.status === 'rejected',
            )
            // A failed batch is left out and the others' rows still show, like
            // the chips, but is marked so the list can't call it empty; a
            // refetch retries it. Only when every batch failed does the read
            // fail, with a real failure outranking a refusal. A batch the
            // device holds none of is simply empty.
            if (failures.length === settled.length) {
                throw (
                    failures.find(
                        failure => !isAccountNotOnDeviceError(failure.reason),
                    ) ?? failures[0]
                ).reason
            }
            return settled.map(result =>
                result.status === 'fulfilled'
                    ? result.value
                    : exhaustedPage(
                          [],
                          !isAccountNotOnDeviceError(result.reason),
                      ),
            )
        },
        initialPageParam: undefined as Optional<SwapHistoryCursor[]>,
        getNextPageParam: (lastPage: SwapHistoryBatchPage[]) =>
            nextSwapHistoryCursors(lastPage),
        enabled: isEnabled && batches.length > 0,
    })

    const { fetchNextPage: loadNextPage } = query
    const fetchNextPage = useCallback(() => void loadNextPage(), [loadNextPage])

    const swaps = useMemo(
        () => (query.data ? mergeSwapHistoryPages(query.data.pages) : []),
        [query.data],
    )

    const hasFailedBatch = useMemo(
        () =>
            query.data?.pages.some(page => page.some(batch => batch.failed)) ??
            false,
        [query.data],
    )

    return {
        swaps,
        isLoading: query.isLoading || (isWaitingForDeviceId && !hasWaitedOut),
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError || (isWaitingForDeviceId && hasWaitedOut),
        hasFailedBatch,
        readKey,
        isAccountNotOnDevice:
            (accounts.length > 0 && onDevice.length === 0) ||
            isAccountNotOnDeviceError(query.error),
        error: query.error,
        hasNextPage: query.hasNextPage,
        fetchNextPage,
        refetch: () => void query.refetch(),
    }
}
