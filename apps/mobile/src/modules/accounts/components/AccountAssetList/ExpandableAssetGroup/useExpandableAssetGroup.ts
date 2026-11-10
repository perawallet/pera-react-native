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

import { useEffect, useMemo, useState } from 'react'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'
import {
    groupIconMemberOf,
    type AssetGroupItem,
    type GroupableHolding,
} from '@modules/assets'

// The backend curates a group's members, never matching them by name, so they
// are one asset and can share its name and icon; only their network differs.
export type AssetGroupMemberIdentity = {
    name: string
    /** The group header's icon; null until its member syncs, leaving members their own. */
    icon: Nullable<{ asset: PeraAsset; chainId: ChainId }>
}

export type UseExpandableAssetGroupParams<T extends GroupableHolding> = {
    item: AssetGroupItem<T>
}

export type UseExpandableAssetGroupResult = {
    shouldRenderMembers: boolean
    memberIdentity: AssetGroupMemberIdentity
}

export const useExpandableAssetGroup = <T extends GroupableHolding>({
    item,
}: UseExpandableAssetGroupParams<T>): UseExpandableAssetGroupResult => {
    const { isExpanded, group, members } = item
    const [wasExpanded, setWasExpanded] = useState(isExpanded)
    const [isCollapsing, setIsCollapsing] = useState(false)

    // Set during render, so the members are still there on the frame the
    // collapse starts.
    if (wasExpanded !== isExpanded) {
        setWasExpanded(isExpanded)
        setIsCollapsing(!isExpanded)
    }

    // Timed rather than on the panel's completion callback, which a stalled UI
    // thread can hold back and the test runtime's reanimated never calls.
    useEffect(() => {
        if (!isCollapsing) return
        const timer = setTimeout(
            () => setIsCollapsing(false),
            EXPANDABLE_PANEL_ANIMATION_DURATION,
        )
        return () => clearTimeout(timer)
    }, [isCollapsing])

    const iconMember = groupIconMemberOf(members)
    const iconAsset = iconMember?.asset ?? null
    const iconChainId = iconMember?.holding.scope.chainId ?? null
    const memberIdentity = useMemo(
        (): AssetGroupMemberIdentity => ({
            name: group.name,
            icon:
                iconAsset && iconChainId
                    ? { asset: iconAsset, chainId: iconChainId }
                    : null,
        }),
        [group.name, iconAsset, iconChainId],
    )

    return {
        shouldRenderMembers: isExpanded || isCollapsing,
        memberIdentity,
    }
}
