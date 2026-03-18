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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePromptContainer } from '../usePromptContainer'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import { UserPreferences } from '@constants/user-preferences'
import { LONG_PROMPT_DISPLAY_DELAY } from '@constants/ui'

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHasAccounts: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
}))

vi.mock('../PinSecurityPrompt/PinSecurityPrompt', () => ({
    PinSecurityPrompt: () => null,
}))

describe('usePromptContainer', () => {
    const mockGetPreference = vi.fn()
    const mockSetPreference = vi.fn()
    const mockCheckPinEnabled = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        ;(usePreferences as Mock).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        })
        ;(useHasAccounts as Mock).mockReturnValue(true)
        mockCheckPinEnabled.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            checkPinEnabled: mockCheckPinEnabled,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return undefined nextPrompt initially', () => {
        mockGetPreference.mockReturnValue(false)
        const { result } = renderHook(() => usePromptContainer())

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should return undefined nextPrompt when user has no accounts', () => {
        ;(useHasAccounts as Mock).mockReturnValue(false)
        mockGetPreference.mockReturnValue(false)

        const { result } = renderHook(() => usePromptContainer())

        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should show prompt after delay when user has accounts and prompt not dismissed', async () => {
        mockGetPreference.mockReturnValue(false)

        const { result } = renderHook(() => usePromptContainer())

        expect(result.current.nextPrompt).toBeUndefined()

        // Flush the async checkPinEnabled call
        await act(async () => {})
        // Then advance past the display delay
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeDefined()
        expect(result.current.nextPrompt?.id).toBe(
            UserPreferences._securityPinSetupPrompt,
        )
    })

    it('should not show prompt if already dismissed', () => {
        mockGetPreference.mockReturnValue(true)

        const { result } = renderHook(() => usePromptContainer())

        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should hide prompt when hidePrompt is called', async () => {
        mockGetPreference.mockReturnValue(false)

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeDefined()

        act(() => {
            result.current.hidePrompt(UserPreferences._securityPinSetupPrompt)
        })

        // After hiding, need to wait for the effect to clear the prompt
        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should dismiss prompt and save preference when dismissPrompt is called', async () => {
        mockGetPreference.mockReturnValue(false)

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeDefined()

        act(() => {
            result.current.dismissPrompt(
                UserPreferences._securityPinSetupPrompt,
            )
        })

        expect(mockSetPreference).toHaveBeenCalledWith(
            UserPreferences._securityPinSetupPrompt,
            true,
        )

        // After dismissing, need to wait for the effect to clear the prompt
        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should return hidePrompt and dismissPrompt functions', () => {
        const { result } = renderHook(() => usePromptContainer())

        expect(typeof result.current.hidePrompt).toBe('function')
        expect(typeof result.current.dismissPrompt).toBe('function')
    })

    it('should clear timeout when prompt changes to undefined', async () => {
        mockGetPreference.mockReturnValue(false)

        const { result, rerender } = renderHook(() => usePromptContainer())

        // Flush the async checkPinEnabled call
        await act(async () => {})
        // Start with prompt available - advance partway through the delay
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY / 2)
        })

        // Change to no accounts (which should clear the timeout)
        ;(useHasAccounts as Mock).mockReturnValue(false)
        rerender()

        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should not show PIN prompt when PIN is already enabled', async () => {
        mockGetPreference.mockReturnValue(false)
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeUndefined()
    })

    it('should self-heal preference when PIN is already enabled', async () => {
        mockGetPreference.mockReturnValue(false)
        mockCheckPinEnabled.mockResolvedValue(true)

        renderHook(() => usePromptContainer())

        // Flush the async checkPinEnabled call
        await act(async () => {})

        expect(mockSetPreference).toHaveBeenCalledWith(
            UserPreferences._securityPinSetupPrompt,
            true,
        )
    })
})
