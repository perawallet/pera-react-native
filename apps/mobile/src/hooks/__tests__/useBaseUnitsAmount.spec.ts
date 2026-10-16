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
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useBaseUnitsAmount } from '../useBaseUnitsAmount'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = { assetId: '0xusdc', decimals: 6, unitName: 'USDC' }

type AssetQuery = ReturnType<typeof useSingleAssetDetailsQuery>

const mockAssetQuery = (query: { data?: unknown; isPending: boolean }) =>
    vi
        .mocked(useSingleAssetDetailsQuery)
        .mockReturnValue(query as unknown as AssetQuery)

describe('useBaseUnitsAmount', () => {
    beforeEach(() => {
        mockAssetQuery({ data: undefined, isPending: false })
    })

    it("converts to the record's display units once it loads", () => {
        mockAssetQuery({ data: USDC, isPending: false })

        const { result } = renderHook(() =>
            useBaseUnitsAmount('0xusdc', new Decimal(5_000_000), SCOPE),
        )

        expect(result.current).toEqual({
            asset: USDC,
            value: new Decimal(5),
            isLoading: false,
        })
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith('0xusdc', SCOPE)
    })

    it('falls back to base units with no asset when the record cannot be read', () => {
        const { result } = renderHook(() =>
            useBaseUnitsAmount('0xusdc', new Decimal(5_000_000), SCOPE),
        )

        expect(result.current).toEqual({
            asset: null,
            value: new Decimal(5_000_000),
            isLoading: false,
        })
    })

    it('has no value while the record is pending', () => {
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useBaseUnitsAmount('0xusdc', new Decimal(5_000_000), SCOPE),
        )

        expect(result.current.value).toBeUndefined()
        expect(result.current.isLoading).toBe(true)
    })

    it('is not loading for an empty asset id, whose query is disabled and pending', () => {
        mockAssetQuery({ data: undefined, isPending: true })

        const { result } = renderHook(() =>
            useBaseUnitsAmount('', undefined, SCOPE),
        )

        expect(result.current.isLoading).toBe(false)
    })

    it('has no value without base units but still returns the record', () => {
        mockAssetQuery({ data: USDC, isPending: false })

        const { result } = renderHook(() =>
            useBaseUnitsAmount('0xusdc', undefined, SCOPE),
        )

        expect(result.current.value).toBeUndefined()
        expect(result.current.asset).toBe(USDC)
    })
})
