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
import { useIsCreatingAccount } from '@modules/onboarding/hooks'
import { useHasNoAccounts } from '@perawallet/wallet-core-accounts'

vi.mock('@modules/onboarding/hooks', () => ({
    useIsCreatingAccount: vi.fn(),
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
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return true if no accounts exist', () => {
        ;(useIsCreatingAccount as Mock).mockReturnValue({
            isCreatingAccount: false,
            setIsCreatingAccount: vi.fn(),
        })
        ;(useHasNoAccounts as Mock).mockReturnValue(true)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(true)
    })

    it('should return true if user is creating an account', () => {
        ;(useIsCreatingAccount as Mock).mockReturnValue({
            isCreatingAccount: true,
            setIsCreatingAccount: vi.fn(),
        })
        ;(useHasNoAccounts as Mock).mockReturnValue(false)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(true)
    })

    it('should return false if accounts exist and user is not creating an account', () => {
        ;(useIsCreatingAccount as Mock).mockReturnValue({
            isCreatingAccount: false,
            setIsCreatingAccount: vi.fn(),
        })
        ;(useHasNoAccounts as Mock).mockReturnValue(false)

        const { result } = renderHook(() => useShowOnboarding())
        expect(result.current).toBe(false)
    })
})
