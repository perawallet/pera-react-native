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
import type { AssetGroup, PeraAsset } from '@perawallet/wallet-core-assets'
import {
    networkTierOf,
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type GroupableHolding = { scope: ChainScope; assetId: string }

/** Pass a module-level constant: the hook memoises on it. */
export type GroupableHoldingAdapter<T extends GroupableHolding> = {
    /** Null while the holding's metadata hasn't synced. */
    assetOf: (holding: T) => Nullable<PeraAsset>
    /** Display units. */
    displayAmountOf: (holding: T, asset: PeraAsset) => Decimal
    /** USD per whole unit; null while unpriced. */
    usdPriceOf: (holding: T) => Nullable<Decimal>
    /** Runs for every holding, so keep it cheap for one in no group. */
    groupOf: (holding: T) => Nullable<AssetGroup>
}

export type GroupedHoldingMember<T> = {
    holding: T
    asset: Nullable<PeraAsset>
    /** Display units; null while the asset's metadata hasn't synced. */
    displayAmount: Nullable<Decimal>
    usdPrice: Nullable<Decimal>
}

export type GroupedHoldingItem<T> =
    | { kind: 'holding'; holding: T; isGroupMember: boolean }
    | {
          kind: 'group'
          group: AssetGroup
          members: GroupedHoldingMember<T>[]
          /** Display units; null while any member's metadata hasn't synced. */
          amount: Nullable<Decimal>
          /** USD, each member at its own network's price; null while any member's is unknown. */
          usdValue: Nullable<Decimal>
          isExpanded: boolean
      }

export type AssetGroupItem<T> = Extract<
    GroupedHoldingItem<T>,
    { kind: 'group' }
>

export type BuildGroupedHoldingItemsParams<T extends GroupableHolding> = {
    holdings: T[]
    expandedGroupIds: ReadonlySet<string>
    adapter: GroupableHoldingAdapter<T>
    /** A holding this rejects stays a plain row whatever group it belongs to. */
    isGroupable?: (scope: ChainScope) => boolean
}

// A test network's holdings never fold into a group with mainnet ones.
export const isMainnetScope = ({ chainId, networkId }: ChainScope): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(chainId) &&
        networkTierOf(chains.get(chainId).descriptor, networkId) === 'mainnet'
    )
}

const holdingKey = (scope: ChainScope, assetId: string): string =>
    `${toScopeKey(scope)}|${assetId}`

// Resolved once per holding; the predicate runs only for holdings in a group.
const collectGroupMembers = <T extends GroupableHolding>(
    holdings: T[],
    adapter: GroupableHoldingAdapter<T>,
    isGroupable: (scope: ChainScope) => boolean,
) => {
    const holdingGroups = holdings.map(holding => {
        const group = adapter.groupOf(holding)
        return group && isGroupable(holding.scope) ? group : undefined
    })
    const membersOf = new Map<string, T[]>()
    holdings.forEach((holding, index) => {
        const group = holdingGroups[index]
        if (!group) return
        const members = membersOf.get(group.id)
        if (members) members.push(holding)
        else membersOf.set(group.id, [holding])
    })
    return { holdingGroups, membersOf }
}

// Members carry their own decimals, so each converts before the sum: base
// units of two chains' tokens don't add.
const toMember = <T extends GroupableHolding>(
    holding: T,
    adapter: GroupableHoldingAdapter<T>,
): GroupedHoldingMember<T> => {
    const asset = adapter.assetOf(holding)
    return {
        holding,
        asset,
        displayAmount: asset ? adapter.displayAmountOf(holding, asset) : null,
        usdPrice: adapter.usdPriceOf(holding),
    }
}

const sumDisplayAmount = <T>(
    members: GroupedHoldingMember<T>[],
): Nullable<Decimal> => {
    let total = new Decimal(0)
    for (const { displayAmount } of members) {
        if (displayAmount === null) return null
        total = total.plus(displayAmount)
    }
    return total
}

// Summed per member rather than amount × one price: the same asset can trade
// at a different USD price on each network. One unknown member leaves the total
// unknown, since a partial sum would understate the holding; a member holding
// none adds nothing, priced or not.
const sumUsdValue = <T>(
    members: GroupedHoldingMember<T>[],
): Nullable<Decimal> => {
    let total = new Decimal(0)
    for (const { displayAmount, usdPrice } of members) {
        if (displayAmount === null) return null
        if (displayAmount.isZero()) continue
        if (usdPrice === null) return null
        total = total.plus(displayAmount.mul(usdPrice))
    }
    return total
}

/**
 * Folds holdings of one group into one group item at the first member's
 * sorted position, followed by its members when expanded. Only groups with two
 * or more holdings present fold; everything else stays a plain row.
 */
export const buildGroupedHoldingItems = <T extends GroupableHolding>({
    holdings,
    expandedGroupIds,
    adapter,
    isGroupable = isMainnetScope,
}: BuildGroupedHoldingItemsParams<T>): GroupedHoldingItem<T>[] => {
    const { holdingGroups, membersOf } = collectGroupMembers(
        holdings,
        adapter,
        isGroupable,
    )

    const items: GroupedHoldingItem<T>[] = []
    const placed = new Set<string>()
    holdings.forEach((holding, index) => {
        const group = holdingGroups[index]
        const present = group ? (membersOf.get(group.id) ?? []) : []
        if (!group || present.length < 2) {
            items.push({ kind: 'holding', holding, isGroupMember: false })
            return
        }
        if (placed.has(group.id)) return
        placed.add(group.id)

        const members = present.map(member => toMember(member, adapter))
        const isExpanded = expandedGroupIds.has(group.id)
        items.push({
            kind: 'group',
            group,
            members,
            amount: sumDisplayAmount(members),
            usdValue: sumUsdValue(members),
            isExpanded,
        })
        if (isExpanded) {
            for (const member of present) {
                items.push({
                    kind: 'holding',
                    holding: member,
                    isGroupMember: true,
                })
            }
        }
    })
    return items
}

export const groupedHoldingItemKey = <T extends GroupableHolding>(
    item: GroupedHoldingItem<T>,
): string =>
    item.kind === 'group'
        ? `group|${item.group.id}`
        : holdingKey(item.holding.scope, item.holding.assetId)
