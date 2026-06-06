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
import { useQuery } from '@tanstack/react-query'
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
import { ensureAccountFetched } from '../sync/account-syncer'
import { getAccountHoldingsPageQueryKey } from './querykeys'

// Repeated 10^decimals values (most assets use 6) — cache to avoid recomputing
// Decimal.pow() per row on every re-derive.
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

export type UseAccountAssetsQueryParams = {
    filters?: AccountHoldingsFilters
    sortMode?: AssetSortMode
    search?: string
    enabled?: boolean
}

export type UseAccountAssetsQueryResult = {
    balances: AssetWithAccountBalance[]
    isPending: boolean
    isRefetching: boolean
    isError: boolean
}

/**
 * A single account's asset list: sorted, filtered and searched **in SQL**, read
 * in one pass. Rendering is virtualized by FlashList, so there's no need to
 * page the data — and paging it over a value sort that changes as prices/
 * metadata enrich caused rows to shuffle between offsets (blank pages, scroll
 * jumps). One stable read avoids that: invalidation refetches in place (data is
 * retained), and a re-sort updates rows without resetting scroll.
 */
export const useAccountAssetsQuery = (
    address: string | undefined,
    {
        filters,
        sortMode = 'balanceDesc',
        search,
        enabled = true,
    }: UseAccountAssetsQueryParams = {},
): UseAccountAssetsQueryResult => {
    const { network } = useNetwork()
    const { data: algoPrices } = useAssetPricesQuery([ALGO_ASSET_ID])

    const query = useQuery({
        queryKey: getAccountHoldingsPageQueryKey(address ?? '', network, {
            filters,
            sortMode,
            search,
        }),
        enabled: !!address && enabled,
        staleTime: Infinity,
        queryFn: async () => {
            // Self-heal a freshly imported/selected account the background sync
            // hasn't populated yet (deduped with the summary query's fetch).
            await ensureAccountFetched(address as string, network)
            return getAccountHoldingsPage({
                accountAddress: address as string,
                network,
                ...filters,
                sortMode,
                search,
            })
        },
    })

    const balances = useMemo(() => {
        const usdAlgoPrice =
            algoPrices?.get(ALGO_ASSET_ID)?.usdPrice ?? new Decimal(0)
        return (query.data ?? []).map(row => toBalance(row, usdAlgoPrice))
    }, [query.data, algoPrices])

    return {
        balances,
        isPending: query.isPending,
        isRefetching: query.isRefetching,
        isError: query.isError,
    }
}
