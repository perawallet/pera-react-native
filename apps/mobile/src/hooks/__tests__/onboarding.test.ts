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

import { renderHook } from '@testing-library/react-native'
import { useShowOnboarding } from '../onboarding'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useHasNoAccounts } from '@perawallet/wallet-core-accounts'

jest.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-accounts', () => ({
    useHasNoAccounts: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: jest.fn(),
    },
}))

describe('useShowOnboarding', () => {
    const mockGetPreference = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        ;(usePreferences as jest.Mock).mockReturnValue({
            getPreference: mockGetPreference,
        })
    })

    it('should return true if no accounts exist', () => {
        mockGetPreference.mockReturnValue(false)
        ;(useHasNoAccounts as jest.Mock).mockReturnValue(true)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(true)
    })

    it('should return true if user is creating an account', () => {
        mockGetPreference.mockReturnValue(true)
        ;(useHasNoAccounts as jest.Mock).mockReturnValue(false)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(true)
    })

    it('should return false if accounts exist and user is not creating an account', () => {
        mockGetPreference.mockReturnValue(false)
        ;(useHasNoAccounts as jest.Mock).mockReturnValue(false)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(false)
    })
})
