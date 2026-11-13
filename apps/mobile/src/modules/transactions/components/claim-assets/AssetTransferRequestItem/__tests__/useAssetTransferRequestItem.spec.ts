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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { imitatedCurrencyOf } from '@perawallet/wallet-core-currencies'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import { useAssetTransferRequestItem } from '../useAssetTransferRequestItem'

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: () => ({ displayName: 'Resolved' }),
}))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const buildItem = (
    unitName: string,
    overrides: { decimals?: number; totalAmount?: Decimal; logo?: string } = {},
) =>
    ({
        id: '741',
        totalAmount: overrides.totalAmount ?? new Decimal(250),
        usdValue: null,
        asset: {
            assetId: '741',
            decimals: overrides.decimals ?? 0,
            name: 'Spoof',
            unitName,
            peraMetadata: overrides.logo ? { logo: overrides.logo } : undefined,
        },
        senders: { count: 0, results: [] },
    }) as unknown as AssetInboxRequest

describe('useAssetTransferRequestItem', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: null,
            isPending: false,
        } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)
    })

    it('reports the code the unit name imitates, judged on the asset id and the payload unit name', () => {
        vi.mocked(imitatedCurrencyOf).mockReturnValueOnce('USD')

        const { result } = renderHook(() =>
            useAssetTransferRequestItem(buildItem('usd'), SCOPE),
        )

        expect(result.current.imitatedCurrency).toBe('USD')
        expect(imitatedCurrencyOf).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '741' },
            'usd',
        )
    })

    it('asks about the payload unit name even when the asset reads as ordinary', () => {
        const { result } = renderHook(() =>
            useAssetTransferRequestItem(buildItem('TST'), SCOPE),
        )

        expect(result.current.imitatedCurrency).toBeNull()
        expect(imitatedCurrencyOf).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '741' },
            'TST',
        )
    })

    it('converts the total to whole units using the asset decimals', () => {
        const item = buildItem('TST', {
            decimals: 2,
            totalAmount: new Decimal(12_345),
        })

        const { result } = renderHook(() =>
            useAssetTransferRequestItem(item, SCOPE),
        )

        expect(result.current.amount.toString()).toBe('123.45')
    })

    describe('resolved asset', () => {
        it('is the payload asset until the full details load', () => {
            const item = buildItem('TST')

            const { result } = renderHook(() =>
                useAssetTransferRequestItem(item, SCOPE),
            )

            expect(result.current.resolvedAsset).toBe(item.asset)
        })

        it('keeps the payload logo when the full details have none', () => {
            vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
                data: { assetId: '741', name: 'Spoof', peraMetadata: {} },
                isPending: false,
            } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

            const { result } = renderHook(() =>
                useAssetTransferRequestItem(
                    buildItem('TST', { logo: 'payload-logo' }),
                    SCOPE,
                ),
            )

            expect(result.current.resolvedAsset.peraMetadata?.logo).toBe(
                'payload-logo',
            )
        })

        it('prefers the full details logo when it has one', () => {
            vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
                data: {
                    assetId: '741',
                    name: 'Spoof',
                    peraMetadata: { logo: 'full-logo' },
                },
                isPending: false,
            } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

            const { result } = renderHook(() =>
                useAssetTransferRequestItem(
                    buildItem('TST', { logo: 'payload-logo' }),
                    SCOPE,
                ),
            )

            expect(result.current.resolvedAsset.peraMetadata?.logo).toBe(
                'full-logo',
            )
        })
    })

    it('shows the resolved display name of the first sender', () => {
        const { result } = renderHook(() =>
            useAssetTransferRequestItem(buildItem('TST'), SCOPE),
        )

        expect(result.current.senderDisplayName).toBe('Resolved')
    })
})
