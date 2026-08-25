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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAssetSecurityTags } from '../useAssetSecurityTags'

const mockAuthorities = vi.fn()
const mockRequest = vi.fn()

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetAuthoritiesQuery: (assetId: string) => mockAuthorities(assetId),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))
vi.mock('../../AssetSecurityInfoContent', () => ({
    AssetSecurityInfoContent: () => null,
}))

type AuthoritiesResult = {
    hasFreeze: boolean
    hasClawback: boolean
    freezeAddress: string | null
    clawbackAddress: string | null
    isSuccess: boolean
}

const authorities = (
    overrides: Partial<AuthoritiesResult> = {},
): AuthoritiesResult => ({
    hasFreeze: false,
    hasClawback: false,
    freezeAddress: null,
    clawbackAddress: null,
    isSuccess: true,
    ...overrides,
})

describe('useAssetSecurityTags', () => {
    beforeEach(() => {
        mockRequest.mockClear()
    })

    it('returns warning tags with active labels when authorities are present', () => {
        mockAuthorities.mockReturnValue(
            authorities({ hasFreeze: true, hasClawback: true }),
        )

        const { result } = renderHook(() => useAssetSecurityTags('123'))

        expect(result.current.isVisible).toBe(true)
        expect(result.current.freezeTag).toMatchObject({
            variant: 'warning',
            label: 'asset_details.markets.freeze',
        })
        expect(result.current.clawbackTag).toMatchObject({
            variant: 'warning',
            label: 'asset_details.markets.clawback',
        })
    })

    it('returns neutral tags with "no" labels when authorities are absent', () => {
        mockAuthorities.mockReturnValue(authorities())

        const { result } = renderHook(() => useAssetSecurityTags('123'))

        expect(result.current.freezeTag).toMatchObject({
            variant: 'neutral',
            label: 'asset_details.markets.no_freeze',
        })
        expect(result.current.clawbackTag).toMatchObject({
            variant: 'neutral',
            label: 'asset_details.markets.no_clawback',
        })
    })

    it('is not visible until the query has succeeded', () => {
        mockAuthorities.mockReturnValue(authorities({ isSuccess: false }))

        const { result } = renderHook(() => useAssetSecurityTags('123'))

        expect(result.current.isVisible).toBe(false)
    })

    it('opens the freeze explainer with the freeze address on freeze tag press', () => {
        mockAuthorities.mockReturnValue(
            authorities({ hasFreeze: true, freezeAddress: 'FREEZEADDR' }),
        )

        const { result } = renderHook(() => useAssetSecurityTags('123'))
        result.current.freezeTag.onPress()

        expect(mockRequest).toHaveBeenCalledTimes(1)
        const request = mockRequest.mock.calls[0][0]
        expect(request.contents.props).toMatchObject({
            authority: 'freeze',
            address: 'FREEZEADDR',
        })
        expect(request.options).toMatchObject({ size: 'auto' })
    })

    it('opens the clawback explainer without an address when the asset has none', () => {
        mockAuthorities.mockReturnValue(authorities())

        const { result } = renderHook(() => useAssetSecurityTags('123'))
        result.current.clawbackTag.onPress()

        const request = mockRequest.mock.calls[0][0]
        expect(request.contents.props).toMatchObject({
            authority: 'clawback',
            address: null,
        })
    })
})
