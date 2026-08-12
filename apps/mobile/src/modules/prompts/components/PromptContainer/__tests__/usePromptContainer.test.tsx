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
import { renderHook, act } from '@testing-library/react'
import { usePromptContainer } from '../usePromptContainer'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useHasAccounts } from '@perawallet/wallet-core-accounts'
import { useBottomSheetStore } from '@modules/bottom-sheet'
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

const { mockIsLockOverlayVisible } = vi.hoisted(() => ({
    mockIsLockOverlayVisible: vi.fn(() => false),
}))

vi.mock(
    '@modules/security/components/AutoLockGuard/lockOverlayContext',
    () => ({ useIsLockOverlayVisible: () => mockIsLockOverlayVisible() }),
)

vi.mock('../PinSecurityPrompt/PinSecurityPrompt', () => ({
    PinSecurityPrompt: () => null,
}))

const { mockUseTermsAcceptance } = vi.hoisted(() => ({
    mockUseTermsAcceptance: vi.fn(),
}))

vi.mock('@modules/onboarding/hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => mockUseTermsAcceptance(),
}))

vi.mock('@modules/onboarding/components/TermsAndConditionsSheet', () => ({
    TermsAcceptancePrompt: () => null,
    TERMS_ACCEPTANCE_PROMPT_ID: 'terms_acceptance_prompt',
}))

describe('usePromptContainer', () => {
    const mockGetPreference = vi.fn()
    const mockSetPreference = vi.fn()
    const mockCheckPinEnabled = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        useBottomSheetStore.getState().resetState()
        ;(usePreferences as Mock).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        })
        ;(useHasAccounts as Mock).mockReturnValue(true)
        mockCheckPinEnabled.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            checkPinEnabled: mockCheckPinEnabled,
        })
        // Default: terms already accepted, so the T&C prompt is out of the way.
        mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: false })
        mockIsLockOverlayVisible.mockReturnValue(false)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return undefined nextPrompt initially', () => {
        mockGetPreference.mockReturnValue(false)
        const { result } = renderHook(() => usePromptContainer())

        expect(result.current.nextPrompt).toBeUndefined()
    })

    describe('while the lock overlay is visible', () => {
        it('does not raise the PIN-setup prompt', async () => {
            mockIsLockOverlayVisible.mockReturnValue(true)
            mockGetPreference.mockReturnValue(false)

            const { result } = renderHook(() => usePromptContainer())

            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            expect(result.current.nextPrompt).toBeUndefined()
        })

        it('does not raise the terms prompt, which has no PIN guard of its own', async () => {
            mockIsLockOverlayVisible.mockReturnValue(true)
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            mockGetPreference.mockReturnValue(true)

            const { result } = renderHook(() => usePromptContainer())

            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            expect(result.current.nextPrompt).toBeUndefined()
        })

        it('tears down a prompt that was already open when the lock engaged', async () => {
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            mockGetPreference.mockReturnValue(true)

            const { result, rerender } = renderHook(() => usePromptContainer())

            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })
            expect(result.current.nextPrompt).toBeDefined()

            mockIsLockOverlayVisible.mockReturnValue(true)
            rerender()

            expect(result.current.nextPrompt).toBeUndefined()
        })

        it('raises the prompt once unlocked', async () => {
            mockIsLockOverlayVisible.mockReturnValue(true)
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            mockGetPreference.mockReturnValue(true)

            const { result, rerender } = renderHook(() => usePromptContainer())

            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })
            expect(result.current.nextPrompt).toBeUndefined()

            mockIsLockOverlayVisible.mockReturnValue(false)
            rerender()

            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            expect(result.current.nextPrompt?.id).toBe(
                'terms_acceptance_prompt',
            )
        })
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

    it('shows the terms prompt with priority when acceptance is needed', async () => {
        // PIN prompt would also be eligible; terms must win.
        mockGetPreference.mockReturnValue(false)
        mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt?.id).toBe('terms_acceptance_prompt')
    })

    it('does not show the terms prompt once terms are accepted', () => {
        mockGetPreference.mockReturnValue(true)
        mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: false })

        const { result } = renderHook(() => usePromptContainer())

        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeUndefined()
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

    it('holds bottom-sheet presentation before the display delay elapses', async () => {
        // A sheet that paints during the delay is already presented and would
        // survive the hold, so the hold must engage the moment a prompt is due.
        mockGetPreference.mockReturnValue(false)
        mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY - 1)
        })

        expect(result.current.nextPrompt).toBeUndefined()
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)
    })

    it('releases the hold when the lock overlay takes the prompt away', async () => {
        mockGetPreference.mockReturnValue(false)

        const { rerender } = renderHook(() => usePromptContainer())

        await act(async () => {})

        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)

        mockIsLockOverlayVisible.mockReturnValue(true)
        await act(async () => {
            rerender()
        })

        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(false)
    })

    it('holds bottom-sheet presentation while a prompt is up', async () => {
        mockGetPreference.mockReturnValue(false)

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        expect(result.current.nextPrompt).toBeDefined()
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)

        // The app lock holds independently — the prompt releasing must not
        // release it.
        act(() => {
            useBottomSheetStore.getState().setPresentationHeld(true, 'app-lock')
            result.current.hidePrompt(UserPreferences._securityPinSetupPrompt)
        })
        await act(async () => {})

        expect(result.current.nextPrompt).toBeUndefined()
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)

        act(() => {
            useBottomSheetStore
                .getState()
                .setPresentationHeld(false, 'app-lock')
        })

        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(false)
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
