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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useIsLanguageSelectionEnabled } from '../useIsLanguageSelectionEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: {
        enable_language_selection: 'enable_language_selection',
    },
}))

describe('useIsLanguageSelectionEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    it('queries the enable_language_selection flag with a false fallback', () => {
        mockGetBooleanValue.mockReturnValue(false)

        renderHook(() => useIsLanguageSelectionEnabled())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_language_selection',
            false,
        )
    })

    it('returns the remote value when set', () => {
        mockGetBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useIsLanguageSelectionEnabled())
        expect(result.current).toBe(true)
    })

    it('stays off when the flag is unset, in every environment', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? true,
        )

        const { result } = renderHook(() => useIsLanguageSelectionEnabled())

        expect(result.current).toBe(false)
    })
})
