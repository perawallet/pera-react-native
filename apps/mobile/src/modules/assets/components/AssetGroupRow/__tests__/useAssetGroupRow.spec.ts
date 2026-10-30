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

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import type { AssetFiatConverter } from '../../../hooks/useAssetListFiatConverter'
import type {
    AssetGroupItem,
    GroupedHoldingMember,
} from '../../../utils/groupedHoldings'
import { useAssetGroupRow } from '../useAssetGroupRow'

type Holding = { scope: ChainScope; assetId: string }

const USDC = { assetId: '31566704', name: 'USD Coin' } as PeraAsset

const withTier = (verificationTier: string) =>
    ({ ...USDC, peraMetadata: { verificationTier } }) as PeraAsset

const member = (
    chainId: 'algorand' | 'ethereum',
    asset: Nullable<PeraAsset> = USDC,
    assetId: string = chainId,
): GroupedHoldingMember<Holding> => ({
    holding: { scope: { chainId, networkId: 'mainnet' }, assetId },
    asset,
    displayAmount: new Decimal(1),
    usdPrice: new Decimal(1),
})

const groupOf = (
    members: GroupedHoldingMember<Holding>[],
    usdValue: Nullable<Decimal>,
): AssetGroupItem<Holding> => ({
    kind: 'group',
    group: {
        id: 'usdc',
        name: 'USD Coin',
        symbol: 'USDC',
    },
    members,
    amount: null,
    usdValue,
    isExpanded: false,
})

// Doubles the USD value into "EUR", so the result shows conversion happened.
const toEur: AssetFiatConverter = (_ref, usdPrice, amount) => ({
    displayCurrency: 'EUR',
    value: usdPrice ? amount.mul(usdPrice).mul(2) : null,
})

describe('useAssetGroupRow', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it("converts the group's USD total to the preferred currency, as a plain amount", () => {
        const convertFiat = vi.fn(toEur)

        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf(
                    [member('algorand'), member('ethereum')],
                    new Decimal('4'),
                ),
                convertFiat,
            }),
        )

        expect(result.current.fiat.displayCurrency).toBe('EUR')
        expect(result.current.fiat.value?.toString()).toBe('8')
        expect(convertFiat.mock.calls[0]?.[0]).toBeNull()
        expect(result.current.chainIds).toEqual(['algorand', 'ethereum'])
        expect(result.current.iconChainId).toBe('algorand')
        expect(result.current.icon).toBe(USDC)
    })

    it('leaves the value unknown while the USD total is', () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf([member('algorand'), member('ethereum')], null),
                convertFiat: toEur,
            }),
        )

        expect(result.current.fiat).toEqual({
            displayCurrency: 'EUR',
            value: null,
        })
    })

    it("takes the most precise member's decimals, so the summed amount keeps its digits", () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf(
                    [
                        member('algorand', { ...USDC, decimals: 6 }),
                        member('ethereum', { ...USDC, decimals: 18 }),
                        member('ethereum', null, 'unsynced'),
                    ],
                    null,
                ),
                convertFiat: toEur,
            }),
        )

        expect(result.current.decimals).toBe(18)
    })

    it("has no icon while the first member's metadata hasn't synced", () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf(
                    [member('algorand', null), member('ethereum')],
                    null,
                ),
                convertFiat: toEur,
            }),
        )

        expect(result.current.icon).toBeNull()
    })

    it('has no icon chain with no members', () => {
        const { result } = renderHook(() =>
            useAssetGroupRow({
                item: groupOf([], null),
                convertFiat: toEur,
            }),
        )

        expect(result.current.iconChainId).toBeNull()
    })

    describe('verification badge', () => {
        const badgeOf = (members: GroupedHoldingMember<Holding>[]) =>
            renderHook(() =>
                useAssetGroupRow({
                    item: groupOf(members, null),
                    convertFiat: toEur,
                }),
            ).result.current

        it('shows the badge its members share', () => {
            const result = badgeOf([
                member('algorand', withTier('verified')),
                member('ethereum', withTier('verified')),
            ])

            expect(result.verificationIcon).toBe('assets/verified')
            expect(result.isSuspicious).toBe(false)
        })

        it('shows the most cautious tier when members differ', () => {
            const result = badgeOf([
                member('algorand', withTier('trusted')),
                member('ethereum', withTier('verified')),
            ])

            expect(result.verificationIcon).toBe('assets/verified')
        })

        it('shows no badge when any member is unverified', () => {
            const result = badgeOf([
                member('algorand', withTier('verified')),
                member('ethereum', USDC),
            ])

            expect(result.verificationIcon).toBeNull()
        })

        it('never hides a suspicious member behind a verified one', () => {
            const result = badgeOf([
                member('algorand', withTier('verified')),
                member('ethereum', withTier('suspicious')),
            ])

            expect(result.verificationIcon).toBe('assets/suspicious')
            expect(result.isSuspicious).toBe(true)
        })

        it("counts a chain's native coin as trusted", () => {
            const result = badgeOf([
                member('algorand', withTier('trusted')),
                member('ethereum', USDC, 'native'),
            ])

            expect(result.verificationIcon).toBe('assets/trusted')
        })

        it("doesn't count a chain's native id on another chain as native", () => {
            const result = badgeOf([
                member('algorand', withTier('trusted')),
                member('ethereum', USDC, '0'),
            ])

            expect(result.verificationIcon).toBeNull()
        })

        it("isn't trusted on a chain this build doesn't register", () => {
            restoreAlgorandOnlyChains()

            const result = badgeOf([
                member('algorand', withTier('trusted')),
                member('ethereum', USDC, 'native'),
            ])

            expect(result.verificationIcon).toBeNull()
        })

        it('shows a suspicious member before the other networks sync', () => {
            const result = badgeOf([
                member('algorand', null),
                member('ethereum', withTier('suspicious')),
            ])

            expect(result.verificationIcon).toBe('assets/suspicious')
            expect(result.isSuspicious).toBe(true)
        })

        it('shows no other badge until every network has synced', () => {
            const result = badgeOf([
                member('algorand', withTier('verified')),
                member('ethereum', null),
            ])

            expect(result.verificationIcon).toBeNull()
            expect(result.isSuspicious).toBe(false)
        })
    })

    describe('subtitle', () => {
        it('names the symbol and the id every network shares', () => {
            const { result } = renderHook(() =>
                useAssetGroupRow({
                    item: groupOf(
                        [
                            member('algorand', USDC, '753101315'),
                            member('ethereum', USDC, '753101315'),
                        ],
                        null,
                    ),
                    convertFiat: toEur,
                }),
            )

            expect(result.current.subtitle).toBe('USDC · 753101315')
        })

        it("names the symbol alone for a native coin, whose shared id is the chains' placeholder", () => {
            const ether = { assetId: 'native', name: 'Ether' } as PeraAsset
            const { result } = renderHook(() =>
                useAssetGroupRow({
                    item: groupOf(
                        [
                            member('ethereum', ether, 'native'),
                            member('ethereum', ether, 'native'),
                        ],
                        null,
                    ),
                    convertFiat: toEur,
                }),
            )

            expect(result.current.subtitle).toBe('USDC')
        })

        it('names the symbol alone when each network has its own id', () => {
            const { result } = renderHook(() =>
                useAssetGroupRow({
                    item: groupOf(
                        [
                            member('algorand', USDC, '31566704'),
                            member('ethereum', USDC, '0xA0b8'),
                        ],
                        null,
                    ),
                    convertFiat: toEur,
                }),
            )

            expect(result.current.subtitle).toBe('USDC')
        })
    })
})
