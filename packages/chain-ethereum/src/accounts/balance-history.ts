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

import { Decimal } from 'decimal.js'
import { z } from 'zod'
import {
    getAccountHoldings,
    type AccountsChainAdapter,
    type HoldingBalanceHistoryPoint,
    type PortfolioHistoryPoint,
} from '@perawallet/wallet-core-accounts'
import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import {
    getAssetsByIds,
    type PriceHistoryPoint,
} from '@perawallet/wallet-core-assets'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    CHART_QUERY_TIMEOUT_MS,
    baseUnitsToDisplayUnits,
    isPeraNetworkError,
    partition,
    queryClient,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    eip155ChainIdOf,
    isEvmNftAssetId,
    toCaip19,
} from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import {
    ASSETS_MAX_IDS,
    ASSETS_SERVICE,
    fetchAssetItems,
    fetchPriceChart,
    fetchWhitelist,
    PRICES_SERVICE,
} from '../assets/api/endpoints'

export const balanceHistoryPath = (eip155ChainId: number | string): string =>
    `/api/v3/evm/${eip155ChainId}/balance-history/`

// The backend's caps: per-field, and addresses × asset_ids × points per call.
const MAX_ADDRESSES = 10
const MAX_ASSETS = 200
const MAX_READS = 73_000

// The backend's grid for each period, and the chart interval on the same
// boundaries: a point is priced by the range-mode point at or before it.
const GRIDS: Record<
    HistoryPeriod,
    { points: number; interval: 'hourly' | 'daily' }
> = {
    'one-day': { points: 24, interval: 'hourly' },
    'one-week': { points: 168, interval: 'hourly' },
    'one-month': { points: 30, interval: 'daily' },
    'one-year': { points: 365, interval: 'daily' },
}

const balanceHistorySchema = z.object({
    results: z.array(
        z.object({
            timestamp: z.string(),
            error: z.string().nullable(),
            // Base units by address, then lowercase CAIP-19 id. An id left out
            // held 0; null was unreadable.
            balances: z
                .record(z.string(), z.record(z.string(), z.string().nullable()))
                .nullable(),
        }),
    ),
})

export type BalanceHistoryResponse = z.infer<typeof balanceHistorySchema>

export type BalanceHistoryRequest = {
    addresses: string[]
    asset_ids: string[]
    period: HistoryPeriod
}

/** Base units by lowercase CAIP-19 id, summed over the requested addresses. */
type Balances = Map<string, Decimal>

export type GridPoint = {
    /** Unix ms. */
    timestamp: number
    balances: Balances
}

// Null when the chain has no balance history on the backend.
const requestBalanceHistory = async (
    scope: ChainScope,
    chain: EvmChain,
    addresses: string[],
    caip19Ids: string[],
    period: HistoryPeriod,
) => {
    try {
        const { data } = await queryClient<unknown>({
            backend: 'pera',
            service: ASSETS_SERVICE,
            scope,
            method: 'POST',
            url: balanceHistoryPath(eip155ChainIdOf(scope, chain)),
            headers: buildIntegrityHeaders(),
            data: { addresses, asset_ids: caip19Ids, period },
            timeout: CHART_QUERY_TIMEOUT_MS,
        })
        return balanceHistorySchema.parse(data).results
    } catch (error) {
        if (
            isPeraNetworkError(error) &&
            error.backendCode === 'balance_history_not_enabled'
        ) {
            return null
        }
        throw error
    }
}

/**
 * The period's past grid points, oldest first, split across as many calls as
 * the backend's caps need. A point any call failed to read is left out; one
 * before the chain's first block held nothing. Null when the chain has no
 * balance history.
 */
export const fetchGridBalances = async (
    scope: ChainScope,
    chain: EvmChain,
    addresses: string[],
    caip19Ids: string[],
    period: HistoryPeriod,
): Promise<Nullable<GridPoint[]>> => {
    const { points } = GRIDS[period]
    const calls = partition(
        addresses.map(address => address.toLowerCase()),
        MAX_ADDRESSES,
    ).flatMap(group =>
        partition(
            caip19Ids,
            Math.max(
                1,
                Math.min(
                    MAX_ASSETS,
                    Math.floor(MAX_READS / (group.length * points)),
                ),
            ),
        ).map(ids => requestBalanceHistory(scope, chain, group, ids, period)),
    )
    const answers = await Promise.all(calls)
    if (answers.some(answer => answer === null)) return null

    const merged = new Map<string, Nullable<Balances>>()
    for (const results of answers) {
        for (const { timestamp, error, balances } of results!) {
            if (!merged.has(timestamp)) merged.set(timestamp, new Map())
            const into = merged.get(timestamp)
            if (!into) continue
            if (error === 'before_chain_start') continue
            if (error !== null || !balances) {
                merged.set(timestamp, null)
                continue
            }
            for (const byAsset of Object.values(balances)) {
                for (const [id, amount] of Object.entries(byAsset)) {
                    if (amount === null) continue
                    const key = id.toLowerCase()
                    into.set(
                        key,
                        (into.get(key) ?? new Decimal(0)).plus(amount),
                    )
                }
            }
        }
    }
    return [...merged]
        .flatMap(([timestamp, balances]) =>
            balances ? [{ timestamp: Date.parse(timestamp), balances }] : [],
        )
        .sort((a, b) => a.timestamp - b.timestamp)
}

export type PricedAsset = {
    decimals: number
    /** Oldest first. */
    prices: PriceHistoryPoint[]
}

/** USD per whole unit at the last chart point at or before `timestamp`. */
export const priceAt = (
    prices: PriceHistoryPoint[],
    timestamp: number,
): Nullable<Decimal> => {
    let price: Nullable<Decimal> = null
    for (const point of prices) {
        if (point.timestamp > timestamp) break
        price = point.usdPrice
    }
    return price
}

/** An asset with no price yet at a point adds nothing to it, as on the account screen. */
export const valuePortfolio = (
    points: GridPoint[],
    assets: Map<string, PricedAsset>,
    nativeCaip19: string,
): PortfolioHistoryPoint[] =>
    points.map(({ timestamp, balances }) => {
        let usdValue = new Decimal(0)
        for (const [id, baseUnits] of balances) {
            const asset = assets.get(id)
            const price = asset && priceAt(asset.prices, timestamp)
            if (!asset || !price) continue
            usdValue = usdValue.plus(
                baseUnitsToDisplayUnits(baseUnits, asset.decimals).times(price),
            )
        }
        const native = assets.get(nativeCaip19)
        const nativePrice = native && priceAt(native.prices, timestamp)
        return {
            timestamp,
            usdValue,
            nativeValue:
                nativePrice && !nativePrice.isZero()
                    ? usdValue.div(nativePrice)
                    : new Decimal(0),
        }
    })

/** A point with no price behind it is left out rather than valued at 0. */
export const valueHolding = (
    points: GridPoint[],
    caip19: string,
    asset: PricedAsset,
): HoldingBalanceHistoryPoint[] =>
    points.flatMap(({ timestamp, balances }) => {
        const price = priceAt(asset.prices, timestamp)
        if (!price) return []
        const amount = baseUnitsToDisplayUnits(
            balances.get(caip19) ?? new Decimal(0),
            asset.decimals,
        )
        return [{ timestamp, amount, usdValue: amount.times(price) }]
    })

const toUtcDay = (timestamp: number): string =>
    new Date(timestamp).toISOString().slice(0, 10)

const hasServices = (ctx: ChainContext, scope: ChainScope): boolean => {
    const offered = ctx.getPeraBackend(scope).services
    return offered.has(ASSETS_SERVICE) && offered.has(PRICES_SERVICE)
}

export const createEthereumBalanceHistoryOps = (
    ctx: ChainContext,
    chain: EvmChain,
    now: () => number = Date.now,
): Required<
    Pick<
        AccountsChainAdapter,
        'fetchPortfolioHistory' | 'fetchHoldingBalanceHistory'
    >
> => {
    const caip19Of = (scope: ChainScope, assetId: string) =>
        toCaip19(assetId, scope, chain).toLowerCase()

    // The backend never answers "now": the stored holdings the account screen
    // shows make that point, valued at the spot price ending a range that
    // reaches today.
    const readHoldings = async (scope: ChainScope, addresses: string[]) =>
        (
            await Promise.all(
                addresses.map(accountAddress =>
                    getAccountHoldings({
                        accountAddress,
                        scope,
                        hideZeroBalance: true,
                    }),
                ),
            )
        )
            .flat()
            .filter(({ assetId }) => !isEvmNftAssetId(assetId))

    const sumBalances = (
        scope: ChainScope,
        holdings: { assetId: string; amount: Decimal }[],
    ): Balances => {
        const balances: Balances = new Map()
        for (const { assetId, amount } of holdings) {
            const key = caip19Of(scope, assetId)
            balances.set(
                key,
                (balances.get(key) ?? new Decimal(0)).plus(amount),
            )
        }
        return balances
    }

    const priceAssets = async (
        scope: ChainScope,
        assetIdByCaip19: Map<string, string>,
        points: GridPoint[],
        period: HistoryPeriod,
    ): Promise<Map<string, PricedAsset>> => {
        const query = {
            from: toUtcDay(points[0]!.timestamp),
            to: toUtcDay(now()),
            interval: GRIDS[period].interval,
        }
        const tokenIds = [...assetIdByCaip19.values()].filter(
            id => id !== chain.nativeAsset.assetId,
        )
        const decimals = new Map<string, number>([
            [chain.nativeAsset.assetId, chain.nativeAsset.decimals],
        ])
        if (tokenIds.length > 0) {
            for (const asset of await getAssetsByIds({
                assetIds: tokenIds,
                scope,
            })) {
                decimals.set(asset.assetId, asset.decimals)
            }
        }
        // A token held only in the past may have no local row (sold before
        // import, fresh install); dropping it would read the history low.
        const unknown = tokenIds.filter(id => !decimals.has(id))
        for (const batch of partition(unknown, ASSETS_MAX_IDS)) {
            const items = await fetchAssetItems(scope, chain, batch)
            items.forEach((item, index) => {
                if (item && item.fraction_decimals !== null) {
                    decimals.set(batch[index]!, item.fraction_decimals)
                }
            })
        }
        const priced = await Promise.all(
            [...assetIdByCaip19].map(async ([caip19, assetId]) => {
                const assetDecimals = decimals.get(assetId)
                if (assetDecimals === undefined) return null
                const prices = await fetchPriceChart(
                    scope,
                    chain,
                    assetId,
                    query,
                )
                return [caip19, { decimals: assetDecimals, prices }] as const
            }),
        )
        return new Map(priced.filter(entry => entry !== null))
    }

    const fetchPortfolioHistory: AccountsChainAdapter['fetchPortfolioHistory'] =
        async (addresses, period, scope) => {
            eip155ChainIdOf(scope, chain)
            if (!hasServices(ctx, scope)) return null
            if (addresses.length === 0) return []
            const [listed, holdings] = await Promise.all([
                fetchWhitelist(scope, chain),
                readHoldings(scope, addresses),
            ])
            const nativeCaip19 = caip19Of(scope, chain.nativeAsset.assetId)
            const assetIdByCaip19 = new Map<string, string>([
                [nativeCaip19, chain.nativeAsset.assetId],
            ])
            for (const { assetId } of listed) {
                assetIdByCaip19.set(caip19Of(scope, assetId), assetId)
            }
            // Tokens held outside the whitelist still count.
            for (const { assetId } of holdings) {
                assetIdByCaip19.set(caip19Of(scope, assetId), assetId)
            }
            const grid = await fetchGridBalances(
                scope,
                chain,
                addresses,
                [...assetIdByCaip19.keys()],
                period,
            )
            if (grid === null) return null
            if (grid.length === 0) return []
            const points = [
                ...grid,
                { timestamp: now(), balances: sumBalances(scope, holdings) },
            ]

            // Only what was ever held needs a chart; the native coin always
            // does, as the unit of nativeValue.
            const held = new Set([nativeCaip19])
            for (const { balances } of points) {
                for (const [id, amount] of balances) {
                    if (!amount.isZero()) held.add(id)
                }
            }
            const assets = await priceAssets(
                scope,
                new Map(
                    [...assetIdByCaip19].filter(([caip19]) => held.has(caip19)),
                ),
                points,
                period,
            )
            return valuePortfolio(points, assets, nativeCaip19)
        }

    const fetchHoldingBalanceHistory: AccountsChainAdapter['fetchHoldingBalanceHistory'] =
        async (address, assetId, period, _currency, scope) => {
            eip155ChainIdOf(scope, chain)
            if (isEvmNftAssetId(assetId) || !hasServices(ctx, scope)) return []
            const caip19 = caip19Of(scope, assetId)
            const [grid, holdings] = await Promise.all([
                fetchGridBalances(scope, chain, [address], [caip19], period),
                readHoldings(scope, [address]),
            ])
            const current = sumBalances(scope, holdings)
            if (!grid?.length) return []
            const points = [
                ...grid,
                {
                    timestamp: now(),
                    balances: new Map([
                        [caip19, current.get(caip19) ?? new Decimal(0)],
                    ]),
                },
            ]
            const asset = (
                await priceAssets(
                    scope,
                    new Map([[caip19, assetId]]),
                    points,
                    period,
                )
            ).get(caip19)
            return asset ? valueHolding(points, caip19, asset) : []
        }

    return { fetchPortfolioHistory, fetchHoldingBalanceHistory }
}
