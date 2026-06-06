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

import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    useAssetPricesQuery,
    type AssetSortMode,
} from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { AssetWithAccountBalance } from '../models'
import {
    getAccountHoldingsPage,
    type AccountHoldingsFilters,
    type AccountHoldingsPageRow,
} from '../db'
import { getAccountHoldingsPageQueryKey } from './querykeys'

const PAGE_SIZE = 30

// Repeated 10^decimals values (most assets use 6) — cache to avoid thousands of
// Decimal.pow() calls as pages accumulate.
const POW10_CACHE = new Map<number, Decimal>()
const pow10 = (decimals: number): Decimal => {
    let value = POW10_CACHE.get(decimals)
    if (!value) {
        value = new Decimal(10).pow(decimals)
        POW10_CACHE.set(decimals, value)
    }
    return value
}

const toBalance = (
    row: AccountHoldingsPageRow,
    usdAlgoPrice: Decimal,
): AssetWithAccountBalance => {
    const isAlgo = row.assetId === ALGO_ASSET_ID
    const asset = row.asset ?? (isAlgo ? ALGO_ASSET : null)
    if (!asset) {
        return {
            assetId: row.assetId,
            asset: undefined,
            amount: new Decimal(0),
            algoValue: new Decimal(0),
            usdPrice: row.usdPrice ?? undefined,
        }
    }
    const usdPrice = row.usdPrice ?? new Decimal(0)
    const amount = row.amount.div(pow10(asset.decimals))
    const algoValue = isAlgo
        ? amount
        : usdAlgoPrice.isZero()
          ? new Decimal(0)
          : amount.times(usdPrice).div(usdAlgoPrice)
    return { assetId: row.assetId, asset, amount, algoValue, usdPrice }
}

export type UseAccountAssetsInfiniteQueryParams = {
    filters?: AccountHoldingsFilters
    sortMode?: AssetSortMode
    search?: string
    enabled?: boolean
}

export type UseAccountAssetsInfiniteQueryResult = {
    balances: AssetWithAccountBalance[]
    isPending: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    isError: boolean
    isRefetching: boolean
}

/**
 * Paginated, DB-sorted asset list for a single account. Sorting, filtering and
 * searching happen in SQL (favorites first, then value/name), and only the
 * fetched pages are materialized into `AssetWithAccountBalance` on the JS
 * thread — so a multi-thousand-asset account renders the first page in constant
 * time and loads more on scroll.
 */
export const useAccountAssetsInfiniteQuery = (
    address: string | undefined,
    {
        filters,
        sortMode = 'balanceDesc',
        search,
        enabled = true,
    }: UseAccountAssetsInfiniteQueryParams = {},
): UseAccountAssetsInfiniteQueryResult => {
    const { network } = useNetwork()
    const { data: algoPrices } = useAssetPricesQuery([ALGO_ASSET_ID])

    const query = useInfiniteQuery({
        queryKey: getAccountHoldingsPageQueryKey(address ?? '', network, {
            filters,
            sortMode,
            search,
        }),
        enabled: !!address && enabled,
        staleTime: Infinity,
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            getAccountHoldingsPage({
                accountAddress: address as string,
                network,
                ...filters,
                sortMode,
                search,
                limit: PAGE_SIZE,
                offset: pageParam,
            }),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length < PAGE_SIZE
                ? undefined
                : allPages.length * PAGE_SIZE,
    })

    const balances = useMemo(() => {
        const usdAlgoPrice =
            algoPrices?.get(ALGO_ASSET_ID)?.usdPrice ?? new Decimal(0)
        return (query.data?.pages ?? [])
            .flat()
            .map(row => toBalance(row, usdAlgoPrice))
    }, [query.data, algoPrices])

    return {
        balances,
        isPending: query.isPending,
        isFetchingNextPage: query.isFetchingNextPage,
        hasNextPage: query.hasNextPage,
        fetchNextPage: query.fetchNextPage,
        isError: query.isError,
        isRefetching: query.isRefetching,
    }
}
