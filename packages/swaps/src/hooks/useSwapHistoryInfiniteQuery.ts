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
import { useInfiniteQuery } from '@tanstack/react-query'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    fetchSwapHistory,
    readForOwnedAccounts,
    routerAccountId,
    type SwapHistoryPage,
} from '../api'
import type {
    SwapAccountAddressOnDevice,
    SwapHistoryItem,
    SwapStatus,
} from '../models'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
import { isAccountNotOnDeviceError } from '../utils/routerErrors'
import { swapQueryKeys } from './querykeys'

const PAGE_SIZE = 20
// Bounds the read-ahead over pages the status filter empties, so a history of
// only hidden rows can't loop the query forever.
const MAX_SKIPPED_PAGES = 10

export type UseSwapHistoryInfiniteQueryResult = {
    swaps: SwapHistoryItem[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    /** None of the accounts is on this device, so the router has no history to give. */
    isAccountNotOnDevice: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

type HistoryPageParam = {
    cursor: string
    /** The router binds a cursor to the accounts it was issued for. */
    accounts: string[]
}

type AccountsPage = SwapHistoryPage & { accounts: string[] }

const fetchVisiblePage = async (
    fetchPage: (param: Optional<HistoryPageParam>) => Promise<AccountsPage>,
    statuses: Optional<SwapStatus[]>,
    param: Optional<HistoryPageParam>,
): Promise<AccountsPage> => {
    const visibleOf = (page: AccountsPage): AccountsPage => ({
        ...page,
        results: page.results.filter(
            item =>
                isSwapHistoryRow(item) &&
                (!statuses || statuses.includes(item.status)),
        ),
    })
    let page = await fetchPage(param)
    for (let skipped = 0; skipped < MAX_SKIPPED_PAGES; skipped++) {
        const visible = visibleOf(page)
        if (visible.results.length > 0 || page.next === null) return visible
        page = await fetchPage({ cursor: page.next, accounts: page.accounts })
    }
    return visibleOf(page)
}

/**
 * The router has no status filter, so `statuses` narrows each page, reading
 * ahead past pages it empties. The device and request scope come from the
 * first account; every account's address is asked for in one list, so an
 * order whose legs sit on two of them shows once. An account the device
 * doesn't hold is left out rather than failing the others: up front when
 * registration doesn't send it, and after the router refuses it otherwise.
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
    const requestScope = onDevice.at(0)?.scope ?? null
    const deviceId = useDeviceIdLookup()(
        requestScope ? deploymentOf(requestScope) : null,
    )
    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.historyInfinite(onDevice, statuses),
        queryFn: ({ pageParam }: { pageParam: Optional<HistoryPageParam> }) => {
            if (!requestScope) throw new Error('No swap account to read')
            const read = (
                routerIds: string[],
                cursor: Optional<string>,
                limit: number = PAGE_SIZE,
            ) =>
                fetchSwapHistory(
                    {
                        deviceId: deviceId ?? '',
                        accounts: routerIds,
                        cursor,
                        limit,
                    },
                    requestScope,
                )
            const fetchPage = async (
                param: Optional<HistoryPageParam>,
            ): Promise<AccountsPage> => {
                if (param) {
                    const page = await read(param.accounts, param.cursor)
                    return { ...page, accounts: param.accounts }
                }
                const { value, accounts: owned } = await readForOwnedAccounts(
                    onDevice.map(account =>
                        routerAccountId(account.scope, account.address),
                    ),
                    (routerIds, limit) => read(routerIds, undefined, limit),
                )
                return { ...value, accounts: owned }
            }
            return fetchVisiblePage(fetchPage, statuses, pageParam)
        },
        initialPageParam: undefined as Optional<HistoryPageParam>,
        getNextPageParam: (lastPage: AccountsPage) =>
            lastPage.next === null
                ? undefined
                : { cursor: lastPage.next, accounts: lastPage.accounts },
        enabled: isEnabled && requestScope !== null && !!deviceId,
    })

    const swaps = query.data?.pages.flatMap(page => page.results) ?? []

    return {
        swaps,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        isAccountNotOnDevice:
            (accounts.length > 0 && onDevice.length === 0) ||
            isAccountNotOnDeviceError(query.error),
        error: query.error,
        hasNextPage: query.hasNextPage,
        fetchNextPage: () => void query.fetchNextPage(),
        refetch: () => void query.refetch(),
    }
}
