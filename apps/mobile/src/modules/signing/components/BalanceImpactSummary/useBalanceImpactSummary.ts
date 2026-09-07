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
import type { Decimal } from 'decimal.js'
import {
    computeBalanceImpact,
    useImpactTransactions,
} from '@perawallet/wallet-core-signing'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import {
    ALGO_ASSET,
    PeraAssetType,
    useAssetPricesQuery,
    useAssetsQuery,
    type DisplayableAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'

export type BalanceImpactDirection = 'receive' | 'spend'

export type BalanceImpactItem = {
    assetId: string
    /** Drives the asset/collectible avatar and the AssetAmount unit + decimals. */
    asset: DisplayableAsset
    isCollectible: boolean
    direction: BalanceImpactDirection
    /** Absolute amount in display units. The direction carries the sign. */
    amount: Decimal
    /**
     * The transaction sweeps this asset's entire remaining balance (a
     * close-remainder/close-to), so `amount` understates the true outflow. The
     * row must present it as the full balance rather than the partial figure.
     */
    isFullBalance: boolean
    /**
     * The asset is minted by this group, so it has no id, price or metadata yet
     * — the row labels it as new instead of converting it.
     */
    isNewAsset: boolean
    /** USD unit price, when known — lets the fiat row convert without a lookup. */
    usdPrice?: Decimal
    /** Collectible only. */
    collectibleTitle?: string
    collectibleSubtitle?: string
}

export type UseBalanceImpactSummaryResult = {
    receive: BalanceImpactItem[]
    spend: BalanceImpactItem[]
    hasImpact: boolean
    /** True while the transaction simulation is still resolving inner txns. */
    isSimulating: boolean
    /**
     * Simulation of an app-call group failed, so the impact is incomplete
     * (the receive side is unknown). The view shows an error instead of a
     * partial impact.
     */
    simulationFailed: boolean
}

type SortableItem = BalanceImpactItem & { sortValue: Decimal }

export const useBalanceImpactSummary = (): UseBalanceImpactSummaryResult => {
    const { transactions, signableAddresses, isSimulating, simulationFailed } =
        useImpactTransactions()

    const impact = useMemo(
        () => computeBalanceImpact(transactions, signableAddresses),
        [transactions, signableAddresses],
    )

    const assetIds = useMemo(
        () =>
            [
                ...new Set([
                    ...impact.deltas.map(d => d.assetId),
                    // A close-only sweep (no explicit transfer) has no delta but
                    // still needs metadata to render its "entire balance" row.
                    ...impact.closedAssetIds,
                ]),
            ].filter(id => id !== ALGO_ASSET_ID),
        [impact.deltas, impact.closedAssetIds],
    )

    // The signed group can touch assets the user doesn't hold (e.g. a swap
    // into a new asset), so they won't be in the local DB. Fetch them so rows
    // show real names/units instead of falling back to the raw asset id.
    const { data: assets } = useAssetsQuery(assetIds, { fetchMissing: true })
    const { data: prices } = useAssetPricesQuery([ALGO_ASSET_ID, ...assetIds])

    return useMemo(() => {
        const closedAssetIds = new Set(impact.closedAssetIds)
        const deltaAssetIds = new Set(impact.deltas.map(d => d.assetId))
        // A close-remainder/close-to with no explicit transfer produces no
        // delta, yet still empties the account — synthesize a zero-amount spend
        // row so the sweep is never invisible. Its amount is unused: the row
        // renders "entire balance" rather than the figure.
        const movements = [
            ...impact.deltas,
            ...impact.closedAssetIds
                .filter(id => !deltaAssetIds.has(id))
                .map(assetId => ({ assetId, amount: 0n })),
        ]
        const items = movements.map<SortableItem>(({ assetId, amount }) => {
            const isAlgo = assetId === ALGO_ASSET_ID
            const asset: PeraAsset | undefined = isAlgo
                ? ALGO_ASSET
                : assets.get(assetId)
            const decimals = asset?.decimals ?? 0
            const isCollectible =
                asset?.peraMetadata?.type === PeraAssetType.collectible

            const displayAbs = baseUnitsToDisplayUnits(
                amount < 0n ? -amount : amount,
                decimals,
            )
            const usdPrice = prices.get(assetId)?.usdPrice
            const sortValue = usdPrice ? displayAbs.times(usdPrice) : displayAbs

            // Without metadata, still render with the id as the unit so the row
            // isn't blank while the asset syncs.
            const displayAsset: DisplayableAsset = asset ?? {
                assetId,
                unitName: assetId,
            }

            const collectible = asset?.peraMetadata?.collectible
            const collectibleSubtitle = isCollectible
                ? [collectible?.collection?.name, assetId]
                      .filter(Boolean)
                      .join(' · ')
                : undefined

            return {
                assetId,
                asset: displayAsset,
                isCollectible,
                direction: amount > 0n ? 'receive' : 'spend',
                amount: displayAbs,
                isFullBalance: closedAssetIds.has(assetId),
                isNewAsset: false,
                usdPrice,
                collectibleTitle: isCollectible
                    ? (collectible?.title ?? asset?.name ?? `#${assetId}`)
                    : undefined,
                collectibleSubtitle,
                sortValue,
            }
        })

        // A mint has no asset id yet, so it never reaches `movements` — build its
        // row straight from the acfg params.
        const mintedItems = impact.createdAssets.map<SortableItem>(created => {
            const amount = baseUnitsToDisplayUnits(
                created.total,
                created.decimals,
            )
            return {
                assetId: created.key,
                asset: {
                    assetId: created.key,
                    name: created.name,
                    unitName: created.unitName,
                    decimals: created.decimals,
                },
                isCollectible: false,
                direction: 'receive',
                amount,
                isFullBalance: false,
                isNewAsset: true,
                sortValue: amount,
            }
        })

        // ALGO first, then highest-value first within each section.
        const order = (list: SortableItem[]): BalanceImpactItem[] =>
            [...list]
                .sort((a, b) => {
                    if (a.assetId === ALGO_ASSET_ID) return -1
                    if (b.assetId === ALGO_ASSET_ID) return 1
                    return b.sortValue.comparedTo(a.sortValue)
                })
                .map(({ sortValue: _sortValue, ...item }) => item)

        const receive = order([
            ...items.filter(item => item.direction === 'receive'),
            ...mintedItems,
        ])
        const spend = order(items.filter(item => item.direction === 'spend'))

        return {
            receive,
            spend,
            hasImpact: receive.length > 0 || spend.length > 0,
            isSimulating,
            simulationFailed,
        }
    }, [impact, assets, prices, isSimulating, simulationFailed])
}
