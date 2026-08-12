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
import { renderHook, act } from '@testing-library/react'
import { Linking } from 'react-native'

const mockHandleDeepLink = vi.fn()
const mockIsValidDeepLink = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        handleDeepLink: mockHandleDeepLink,
        isValidDeepLink: mockIsValidDeepLink,
    }),
}))

import { useBannerLinkRouter } from '../useBannerLinkRouter'

beforeEach(() => {
    mockHandleDeepLink.mockReset()
    mockIsValidDeepLink.mockReset()
    vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
})

describe('useBannerLinkRouter', () => {
    it('no-ops when URL is null', () => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() => result.current.route({ url: null, isExternal: false }))
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('opens external URLs with Linking.openURL', () => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'https://example.com',
                isExternal: true,
            }),
        )
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com')
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('routes internal valid deep links via handleDeepLink', () => {
        mockIsValidDeepLink.mockReturnValue(true)
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'pera://staking',
                isExternal: false,
            }),
        )
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            'pera://staking',
            false,
            'in-app',
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('falls back to Linking.openURL when URL is not a valid deep link', () => {
        mockIsValidDeepLink.mockReturnValue(false)
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'https://example.com',
                isExternal: false,
            }),
        )
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com')
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })
})
