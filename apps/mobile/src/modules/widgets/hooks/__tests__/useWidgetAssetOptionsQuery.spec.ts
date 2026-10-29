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
import { useWidgetAssetOptionsQuery } from '../useWidgetAssetOptionsQuery'

const mocks = vi.hoisted(() => ({ useHeldAssetDetailsQuery: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHeldAssetDetailsQuery: mocks.useHeldAssetDetailsQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    PeraAssetVerificationTier: { verified: 'verified' },
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as never

const asset = (
    assetId: string,
    verificationTier: string,
    extra: Record<string, unknown> = {},
) => ({
    assetId,
    name: `Asset ${assetId}`,
    unitName: `A${assetId}`,
    peraMetadata: { verificationTier, ...extra },
})

const heldAssets = (assets: unknown[] | undefined, isError = false) =>
    mocks.useHeldAssetDetailsQuery.mockReturnValue({ assets, isError })

const renderQuery = (addresses: string[], enabled = true) =>
    renderHook(() => useWidgetAssetOptionsQuery(addresses, SCOPE, enabled))

describe('useWidgetAssetOptionsQuery', () => {
    beforeEach(() => {
        mocks.useHeldAssetDetailsQuery.mockReset()
    })

    it('asks for the fungible holdings of the given accounts', () => {
        heldAssets(undefined)

        renderQuery(['A', 'B'])

        expect(mocks.useHeldAssetDetailsQuery).toHaveBeenCalledWith(
            ['A', 'B'],
            SCOPE,
            { kind: 'fungible', enabled: true },
        )
    })

    // A spoofed "USDC" must never reach the home screen picker.
    it('offers only verified assets', () => {
        heldAssets([
            asset('1', 'verified'),
            asset('2', 'unverified'),
            asset('3', 'suspicious'),
        ])

        const { result } = renderQuery(['A'])

        expect(result.current.options).toEqual([
            { assetId: '1', name: 'Asset 1', unitName: 'A1' },
        ])
    })

    it('leaves out ALGO and collectibles', () => {
        heldAssets([
            asset('0', 'verified'),
            asset('1', 'verified', { collectible: { title: 'Art' } }),
            asset('2', 'verified'),
        ])

        const { result } = renderQuery(['A'])

        expect(result.current.options?.map(option => option.assetId)).toEqual([
            '2',
        ])
    })

    it('stays undefined while loading or disabled', () => {
        heldAssets(undefined)

        expect(renderQuery(['A']).result.current.options).toBeUndefined()
        expect(renderQuery(['A'], false).result.current.options).toBeUndefined()
    })

    it('reports no options when the read fails or there are no accounts', () => {
        heldAssets(undefined, true)
        expect(renderQuery(['A']).result.current.options).toEqual([])

        heldAssets(undefined)
        expect(renderQuery([]).result.current.options).toEqual([])
    })
})
