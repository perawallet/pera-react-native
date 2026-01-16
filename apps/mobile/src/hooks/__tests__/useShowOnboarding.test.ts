/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useShowOnboarding } from '../useShowOnboarding'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useHasNoAccounts } from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHasNoAccounts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: vi.fn(),
    },
}))

describe('useShowOnboarding', () => {
    const mockHasPreference = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(usePreferences as Mock).mockReturnValue({
            hasPreference: mockHasPreference,
        })
    })

    it('should return true if no accounts exist', () => {
        mockHasPreference.mockReturnValue(false)
        ;(useHasNoAccounts as Mock).mockReturnValue(true)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(true)
    })

    it('should return true if user is creating an account', () => {
        mockHasPreference.mockReturnValue(true)
        ;(useHasNoAccounts as Mock).mockReturnValue(false)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(true)
    })

    it('should return false if accounts exist and user is not creating an account', () => {
        mockHasPreference.mockReturnValue(false)
        ;(useHasNoAccounts as Mock).mockReturnValue(false)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(false)
    })
})
