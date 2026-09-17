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
import { usePromptStore } from '@modules/prompts/store'
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
    // Feeds the biometrics-disabled candidate. Null keeps it off the queue, so
    // the ordering cases below stay about the prompts they name.
    useBiometrics: vi.fn(() => ({
        disabledReason: null,
        acknowledgeBiometricsDisabled: vi.fn(),
        enableBiometrics: vi.fn(),
    })),
}))

const { mockIsLockOverlayVisible } = vi.hoisted(() => ({
    mockIsLockOverlayVisible: vi.fn(() => false),
}))

vi.mock('@hooks/useIsLockOverlayVisible', () => ({
    useIsLockOverlayVisible: () => mockIsLockOverlayVisible(),
}))

vi.mock('../PinSecurityPrompt/PinSecurityPrompt', () => ({
    PinSecurityPrompt: () => null,
}))

const { mockUseTermsAcceptance } = vi.hoisted(() => ({
    mockUseTermsAcceptance: vi.fn(),
}))

// Which banner is due is useBannerPrompt's job and has its own spec; this file
// is about the order the queue puts prompts in.
const { mockUseBannerPrompt } = vi.hoisted(() => ({
    mockUseBannerPrompt: vi.fn(() => ({ isDue: false, isForced: false })),
}))

vi.mock('@modules/prompts/hooks/useBannerPrompt', () => ({
    useBannerPrompt: () => mockUseBannerPrompt(),
}))

// Which wallet-level condition makes this due is useLegacyQuantumPrompt's job
// and has its own spec; this file is about the order the queue puts prompts
// in.
const { mockUseLegacyQuantumPrompt } = vi.hoisted(() => ({
    mockUseLegacyQuantumPrompt: vi.fn(() => ({
        isDue: false,
        shouldUseDependentAwareCopy: false,
    })),
}))

vi.mock('@modules/prompts/hooks/useLegacyQuantumPrompt', () => ({
    useLegacyQuantumPrompt: () => mockUseLegacyQuantumPrompt(),
}))

vi.mock('@modules/prompts/components/LegacyQuantumPrompt', () => ({
    LegacyQuantumPrompt: () => null,
}))

vi.mock('@modules/prompts/components/BannerPrompt', () => ({
    BannerPrompt: () => null,
    BANNER_PROMPT_ID: 'banner_prompt',
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
        // Dismissal and the entry delay are session state now, so they outlive
        // a renderHook and would leak into the next test.
        usePromptStore.getState().resetState()
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
        mockUseBannerPrompt.mockReturnValue({ isDue: false, isForced: false })
        mockUseLegacyQuantumPrompt.mockReturnValue({
            isDue: false,
            shouldUseDependentAwareCopy: false,
        })
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

    describe('ordering', () => {
        it('shows the highest-priority due prompt first', async () => {
            // Terms and the PIN nudge both due — legally-required copy wins.
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            mockGetPreference.mockReturnValue(false)

            const { result } = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            expect(result.current.nextPrompt?.id).toBe(
                'terms_acceptance_prompt',
            )
        })

        it('advances to the next prompt without paying the entry delay again', async () => {
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            mockGetPreference.mockReturnValue(false)

            const { result } = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })
            expect(result.current.nextPrompt?.id).toBe(
                'terms_acceptance_prompt',
            )

            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: false })
            await act(async () => {
                result.current.hidePrompt('terms_acceptance_prompt')
            })

            // Deliberately no timer advance. Only the first interruption of a
            // session waits; that is what turns the storm into one
            // flow rather than three separate ambushes.
            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._securityPinSetupPrompt,
            )
        })

        it('runs terms, then a forced banner, then the PIN nudge', async () => {
            // The migration case: everything due at once. A forced
            // banner may be a forced update notice, so it outranks the nudge
            // but never the legally-required copy.
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            mockUseBannerPrompt.mockReturnValue({
                isDue: true,
                isForced: true,
            })
            mockGetPreference.mockReturnValue(false)

            const { result } = renderHook(() => usePromptContainer())
            await act(async () => {})
            expect(result.current.nextPrompt?.id).toBe(
                'terms_acceptance_prompt',
            )

            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: false })
            await act(async () => {
                result.current.hidePrompt('terms_acceptance_prompt')
            })
            expect(result.current.nextPrompt?.id).toBe('banner_prompt')

            mockUseBannerPrompt.mockReturnValue({
                isDue: false,
                isForced: false,
            })
            await act(async () => {
                result.current.hidePrompt('banner_prompt')
            })
            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._securityPinSetupPrompt,
            )
        })

        it('ranks a select banner below the PIN nudge', async () => {
            // Same surface, softer rules: `select` is the gentlest thing in the
            // queue, so it waits for everything else.
            mockUseBannerPrompt.mockReturnValue({
                isDue: true,
                isForced: false,
            })
            mockGetPreference.mockReturnValue(false)

            const { result } = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._securityPinSetupPrompt,
            )
        })

        it('ranks the legacy quantum notice above a select banner but below the PIN nudge', async () => {
            mockUseBannerPrompt.mockReturnValue({
                isDue: true,
                isForced: false,
            })
            mockUseLegacyQuantumPrompt.mockReturnValue({
                isDue: true,
                shouldUseDependentAwareCopy: false,
            })
            mockGetPreference.mockReturnValue(false)

            const { result } = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            // The PIN nudge is also due, so it wins first.
            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._securityPinSetupPrompt,
            )

            await act(async () => {
                result.current.hidePrompt(
                    UserPreferences._securityPinSetupPrompt,
                )
            })

            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._legacyQuantumNoticePrompt,
            )
        })

        it('does not show the legacy quantum notice once its preference is set', async () => {
            mockUseLegacyQuantumPrompt.mockReturnValue({
                isDue: true,
                shouldUseDependentAwareCopy: false,
            })
            // Blanket true: every preference (including this prompt's own) is
            // already answered, so nothing in the queue is due.
            mockGetPreference.mockReturnValue(true)

            const { result } = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            expect(result.current.nextPrompt).toBeUndefined()
        })

        it('treats a forced banner as a gate and a select banner as a nudge', async () => {
            mockUseBannerPrompt.mockReturnValue({
                isDue: true,
                isForced: true,
            })
            mockGetPreference.mockReturnValue(true)

            const forced = renderHook(() => usePromptContainer())
            await act(async () => {})

            // A gate renders with no delay and holds sheet presentation.
            expect(forced.result.current.nextPrompt?.id).toBe('banner_prompt')
            expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)

            forced.unmount()
            useBottomSheetStore.getState().resetState()
            usePromptStore.getState().resetState()
            mockUseBannerPrompt.mockReturnValue({
                isDue: true,
                isForced: false,
            })

            const select = renderHook(() => usePromptContainer())
            await act(async () => {})

            expect(select.result.current.nextPrompt).toBeUndefined()
            expect(useBottomSheetStore.getState().isPresentationHeld).toBe(
                false,
            )
        })

        it('keeps a dismissal across a container remount', async () => {
            mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })
            // PIN already handled, so only the terms prompt is in play.
            mockGetPreference.mockReturnValue(true)

            const first = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })
            await act(async () => {
                first.result.current.hidePrompt('terms_acceptance_prompt')
            })
            first.unmount()

            const second = renderHook(() => usePromptContainer())
            await act(async () => {})
            act(() => {
                vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
            })

            // Dismissal used to be the container's own state, so a remount
            // brought the prompt straight back.
            expect(second.result.current.nextPrompt).toBeUndefined()
        })
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

    it('renders a gate the moment it is due, leaving no silent hold window', async () => {
        // A sheet that paints while the hold is on is recorded as presented and
        // survives it, so a gate must hold from the moment it is due. Rendering
        // in the same breath is what stops that hold being silent: any gap is a
        // window where the app looks idle and discards taps.
        mockGetPreference.mockReturnValue(false)
        mockUseTermsAcceptance.mockReturnValue({ needsAcceptance: true })

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})

        // Deliberately no timer advance.
        expect(result.current.nextPrompt?.id).toBe('terms_acceptance_prompt')
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)
    })

    it('does not hold while a nudge is merely due', async () => {
        // The PIN nudge is not a gate, so a sheet the user opened on purpose
        // must still present. Holding here discarded it silently for the length
        // of the display delay.
        mockGetPreference.mockReturnValue(false)

        const { result } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY - 1)
        })

        expect(result.current.nextPrompt).toBeUndefined()
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(false)
    })

    it('releases the hold when the lock overlay takes the prompt away', async () => {
        mockGetPreference.mockReturnValue(false)

        const { rerender } = renderHook(() => usePromptContainer())

        await act(async () => {})
        act(() => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

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
