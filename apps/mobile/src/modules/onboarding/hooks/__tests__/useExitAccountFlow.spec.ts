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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExitAccountFlow } from '../useExitAccountFlow'

const mockNavigate = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

const mockSetIsOnboarding = vi.fn()
let mockIsOnboarding = false

vi.mock('../useOnboardingStore', () => ({
    useIsOnboarding: () => ({
        isOnboarding: mockIsOnboarding,
        setIsOnboarding: mockSetIsOnboarding,
    }),
}))

describe('useExitAccountFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsOnboarding = false
    })

    it('navigates to TabBar Home when not in onboarding flow', () => {
        mockIsOnboarding = false

        const { result } = renderHook(() => useExitAccountFlow())

        act(() => {
            result.current.exitAccountFlow()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
        expect(mockSetIsOnboarding).not.toHaveBeenCalled()
    })

    it('sets isOnboarding to false when in onboarding flow', () => {
        mockIsOnboarding = true

        const { result } = renderHook(() => useExitAccountFlow())

        act(() => {
            result.current.exitAccountFlow()
        })

        expect(mockSetIsOnboarding).toHaveBeenCalledWith(false)
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
