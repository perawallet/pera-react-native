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
import {
    assetFromHoldingLiteRow,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import type { AssetGroup } from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export type AssetListItem =
    | { kind: 'holding'; row: AccountHoldingsLiteRow; isGroupMember: boolean }
    | {
          kind: 'group'
          group: AssetGroup
          members: AccountHoldingsLiteRow[]
          /** Display units; null while any member's metadata hasn't synced. */
          amount: Nullable<Decimal>
          isExpanded: boolean
      }

export type BuildAssetListItemsParams = {
    rows: AccountHoldingsLiteRow[]
    groups: AssetGroup[]
    expandedGroupIds: ReadonlySet<string>
    /** A row this rejects stays a plain row whatever group it belongs to. */
    isGroupable: (scope: ChainScope) => boolean
}

const holdingKey = (scope: ChainScope, assetId: string): string =>
    `${toScopeKey(scope)}|${assetId}`

// Members carry their own decimals, so each converts before the sum: base
// units of two chains' tokens don't add.
const sumDisplayAmount = (
    members: AccountHoldingsLiteRow[],
): Nullable<Decimal> => {
    let total = new Decimal(0)
    for (const member of members) {
        const asset = assetFromHoldingLiteRow(member, member.scope.chainId)
        if (!asset) return null
        total = total.plus(
            baseUnitsToDisplayUnits(member.amount, asset.decimals),
        )
    }
    return total
}

/**
 * Folds rows the groups name into one group item at the first member's sorted
 * position, followed by its members when expanded. Only groups with two or
 * more rows present fold; everything else stays a plain row.
 */
export const buildAssetListItems = ({
    rows,
    groups,
    expandedGroupIds,
    isGroupable,
}: BuildAssetListItemsParams): AssetListItem[] => {
    // The common case, and the list can hold thousands of rows: skip the
    // per-row lookups entirely.
    if (groups.length === 0) {
        return rows.map(row => ({ kind: 'holding', row, isGroupMember: false }))
    }

    const groupOf = new Map<string, AssetGroup>()
    for (const group of groups) {
        for (const member of group.members) {
            const key = holdingKey(member.scope, member.assetId)
            if (!groupOf.has(key)) groupOf.set(key, group)
        }
    }

    // Resolved once per row; the predicate runs only for rows a group names.
    const rowGroups = rows.map(row => {
        const group = groupOf.get(holdingKey(row.scope, row.assetId))
        return group && isGroupable(row.scope) ? group : undefined
    })

    const membersOf = new Map<string, AccountHoldingsLiteRow[]>()
    rows.forEach((row, index) => {
        const group = rowGroups[index]
        if (!group) return
        const members = membersOf.get(group.id)
        if (members) members.push(row)
        else membersOf.set(group.id, [row])
    })

    const items: AssetListItem[] = []
    const placed = new Set<string>()
    rows.forEach((row, index) => {
        const group = rowGroups[index]
        const members = group ? (membersOf.get(group.id) ?? []) : []
        if (!group || members.length < 2) {
            items.push({ kind: 'holding', row, isGroupMember: false })
            return
        }
        if (placed.has(group.id)) return
        placed.add(group.id)

        const isExpanded = expandedGroupIds.has(group.id)
        items.push({
            kind: 'group',
            group,
            members,
            amount: sumDisplayAmount(members),
            isExpanded,
        })
        if (isExpanded) {
            for (const member of members) {
                items.push({
                    kind: 'holding',
                    row: member,
                    isGroupMember: true,
                })
            }
        }
    })
    return items
}

export const assetListItemKey = (item: AssetListItem): string =>
    item.kind === 'group'
        ? `group|${item.group.id}`
        : holdingKey(item.row.scope, item.row.assetId)
