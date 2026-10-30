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
import { Decimal } from 'decimal.js'
import {
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { nativeAssetInfoOf } from '@modules/chain-ui/icon'
import type {
    AssetFiatConverter,
    AssetFiatValue,
} from '../../hooks/useAssetListFiatConverter'
import type {
    AssetGroupItem,
    GroupableHolding,
} from '../../utils/groupedHoldings'
import { getVerificationIcon } from '../../utils/verification'

const ONE = new Decimal(1)

const isNativeHolding = ({ scope, assetId }: GroupableHolding): boolean =>
    nativeAssetInfoOf({ chainId: scope.chainId, assetId }) !== undefined

// `trusted` isn't a metadata tier: only a chain's native coin earns it, as on single rows.
type GroupTier = PeraAssetVerificationTier | 'trusted'

// Lowest first: a group shows its most cautious member's tier, so one
// suspicious network is never hidden behind a verified one.
const TIER_CAUTION_ORDER: readonly GroupTier[] = [
    PeraAssetVerificationTier.suspicious,
    PeraAssetVerificationTier.unverified,
    PeraAssetVerificationTier.verified,
    'trusted',
]

const cautionRankOf = (tier: GroupTier): number => {
    const rank = TIER_CAUTION_ORDER.indexOf(tier)
    return rank === -1
        ? TIER_CAUTION_ORDER.indexOf(PeraAssetVerificationTier.unverified)
        : rank
}

export type UseAssetGroupRowParams<T extends GroupableHolding> = {
    item: AssetGroupItem<T>
    convertFiat: AssetFiatConverter
}

export type UseAssetGroupRowResult = {
    /** Null until the first member's metadata has synced. */
    icon: Nullable<PeraAsset>
    /** Null until every member has synced, unless one is already suspicious. */
    verificationIcon: Nullable<IconName>
    isSuspicious: boolean
    /** "SYMBOL · id" when every network shares one id, else the symbol alone. */
    subtitle: string
    chainIds: ChainId[]
    /** The chain of the member `icon` is drawn from. */
    iconChainId: Nullable<ChainId>
    /** The most precise member's, so the summed amount loses none of its digits. */
    decimals: number
    /** Null value while any member's is unknown. */
    fiat: AssetFiatValue
}

export const useAssetGroupRow = <T extends GroupableHolding>({
    item,
    convertFiat,
}: UseAssetGroupRowParams<T>): UseAssetGroupRowResult => {
    const { group, members } = item

    const chainIds = useMemo(
        () => members.map(member => member.holding.scope.chainId),
        [members],
    )

    // The item's USD total already prices each network on its own; converting
    // it as one unit at that price keeps the native-asset fallback out, which
    // only applies to a single native holding.
    const fiat = useMemo(
        () => convertFiat(null, item.usdValue, ONE),
        [item.usdValue, convertFiat],
    )

    // Suspicious shows at once, since no later member can rank lower; any other
    // tier waits for every network, as the amounts do, so it never shows early
    // and then turns out wrong.
    const tier = useMemo((): Nullable<GroupTier> => {
        const tiers = members.map(({ asset, holding }): Nullable<GroupTier> => {
            if (!asset) return null
            return isNativeHolding(holding)
                ? 'trusted'
                : (asset.peraMetadata?.verificationTier ??
                      PeraAssetVerificationTier.unverified)
        })
        if (tiers.includes(PeraAssetVerificationTier.suspicious)) {
            return PeraAssetVerificationTier.suspicious
        }
        const synced = tiers.filter((tier): tier is GroupTier => tier !== null)
        if (synced.length < tiers.length) return null
        return synced.reduce<Nullable<GroupTier>>(
            (lowest, next) =>
                lowest === null || cautionRankOf(next) < cautionRankOf(lowest)
                    ? next
                    : lowest,
            null,
        )
    }, [members])

    // A native coin's id is a placeholder, never `<unit> · native`, as on single rows.
    const subtitle = useMemo(() => {
        const ids = new Set(members.map(({ holding }) => holding.assetId))
        const [sharedId] = ids
        const isNative = members.some(({ holding }) => isNativeHolding(holding))
        return ids.size === 1 && sharedId && !isNative
            ? `${group.symbol} · ${sharedId}`
            : group.symbol
    }, [members, group.symbol])

    const decimals = useMemo(
        () => Math.max(0, ...members.map(({ asset }) => asset?.decimals ?? 0)),
        [members],
    )

    return {
        icon: members[0]?.asset ?? null,
        verificationIcon: tier ? getVerificationIcon(tier) : null,
        isSuspicious: tier === PeraAssetVerificationTier.suspicious,
        subtitle,
        chainIds,
        iconChainId: members[0]?.holding.scope.chainId ?? null,
        decimals,
        fiat,
    }
}
