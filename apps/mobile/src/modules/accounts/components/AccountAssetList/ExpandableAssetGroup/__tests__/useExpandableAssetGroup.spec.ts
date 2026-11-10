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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'
import type { AssetGroupItem, GroupedHoldingMember } from '@modules/assets'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useExpandableAssetGroup } from '../useExpandableAssetGroup'

type Holding = { scope: ChainScope; assetId: string }

const asset = (name: string, logo?: string): PeraAsset =>
    ({ assetId: name, name, peraMetadata: { logo } }) as PeraAsset

const member = (
    chainId: 'algorand' | 'ethereum',
    memberAsset: Nullable<PeraAsset>,
): GroupedHoldingMember<Holding> => ({
    holding: { scope: { chainId, networkId: 'mainnet' }, assetId: chainId },
    asset: memberAsset,
    displayAmount: new Decimal(1),
    usdPrice: new Decimal(1),
    isUnreadZero: false,
})

const groupItem = ({
    isExpanded = false,
    members = [
        member('algorand', asset('USDC')),
        member('ethereum', asset('USD Coin')),
    ],
}: {
    isExpanded?: boolean
    members?: GroupedHoldingMember<Holding>[]
} = {}): AssetGroupItem<Holding> => ({
    kind: 'group',
    group: { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
    members,
    amount: null,
    usdValue: null,
    isExpanded,
})

describe('useExpandableAssetGroup', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        registerEthereumChain()
    })

    afterEach(() => {
        vi.useRealTimers()
        restoreAlgorandOnlyChains()
    })

    it('renders members only while expanded when nothing has changed', () => {
        const collapsed = renderHook(() =>
            useExpandableAssetGroup({ item: groupItem({ isExpanded: false }) }),
        )
        const expanded = renderHook(() =>
            useExpandableAssetGroup({ item: groupItem({ isExpanded: true }) }),
        )

        expect(collapsed.result.current.shouldRenderMembers).toBe(false)
        expect(expanded.result.current.shouldRenderMembers).toBe(true)
    })

    it('mounts members as soon as the group expands', () => {
        const { result, rerender } = renderHook(
            ({ isExpanded }) =>
                useExpandableAssetGroup({ item: groupItem({ isExpanded }) }),
            { initialProps: { isExpanded: false } },
        )

        rerender({ isExpanded: true })

        expect(result.current.shouldRenderMembers).toBe(true)
    })

    it('keeps members through the collapse animation, then drops them', () => {
        const { result, rerender } = renderHook(
            ({ isExpanded }) =>
                useExpandableAssetGroup({ item: groupItem({ isExpanded }) }),
            { initialProps: { isExpanded: true } },
        )

        rerender({ isExpanded: false })
        expect(result.current.shouldRenderMembers).toBe(true)

        act(() => {
            vi.advanceTimersByTime(EXPANDABLE_PANEL_ANIMATION_DURATION)
        })
        expect(result.current.shouldRenderMembers).toBe(false)
    })

    it('keeps members when the group re-expands mid-collapse', () => {
        const { result, rerender } = renderHook(
            ({ isExpanded }) =>
                useExpandableAssetGroup({ item: groupItem({ isExpanded }) }),
            { initialProps: { isExpanded: true } },
        )

        rerender({ isExpanded: false })
        rerender({ isExpanded: true })
        act(() => {
            vi.advanceTimersByTime(EXPANDABLE_PANEL_ANIMATION_DURATION)
        })

        expect(result.current.shouldRenderMembers).toBe(true)
    })

    describe('member identity', () => {
        it("gives every member the group's name", () => {
            const { result } = renderHook(() =>
                useExpandableAssetGroup({ item: groupItem() }),
            )

            expect(result.current.memberIdentity.name).toBe('USD Coin')
        })

        it('gives every member the icon the group header draws', () => {
            const branded = asset('USD Coin', 'https://logo/usdc.png')
            const { result } = renderHook(() =>
                useExpandableAssetGroup({
                    item: groupItem({
                        members: [
                            member('algorand', asset('USDC')),
                            member('ethereum', branded),
                        ],
                    }),
                }),
            )

            expect(result.current.memberIdentity.icon).toEqual({
                asset: branded,
                chainId: 'ethereum',
            })
        })

        it("leaves members their own icons while the header's member hasn't synced", () => {
            const { result } = renderHook(() =>
                useExpandableAssetGroup({
                    item: groupItem({
                        members: [
                            member('algorand', null),
                            member('ethereum', asset('USD Coin')),
                        ],
                    }),
                }),
            )

            expect(result.current.memberIdentity.icon).toBeNull()
        })
    })
})
