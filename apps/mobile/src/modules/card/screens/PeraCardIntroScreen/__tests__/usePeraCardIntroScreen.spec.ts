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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CardEvent } from '@analytics'
import { usePeraCardIntroScreen } from '../usePeraCardIntroScreen'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mockInfoToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mockInfoToast,
        showToast: vi.fn(),
        errorToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

const mockOpenURL = vi.fn()
vi.mock('react-native', () => ({
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
}))

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

const mockResetOnboardingProgress = vi.fn()
vi.mock('@perawallet/wallet-core-card', () => ({
    useCardStore: Object.assign(() => {}, {
        getState: () => ({
            resetOnboardingProgress: mockResetOnboardingProgress,
        }),
    }),
}))

vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-config',
    )
    return {
        ...actual,
        config: {
            peraCardLearnMoreUrl: 'https://example.com/pera-card',
        },
    }
})

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: {
                changeLanguage: vi.fn(),
                language: 'en',
            },
        }),
    }
})

describe('usePeraCardIntroScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
    })

    it('handleCreateAccount resets stale onboarding progress then navigates', () => {
        const { result } = renderHook(() => usePeraCardIntroScreen())

        act(() => {
            result.current.handleCreateAccount()
        })

        expect(mockResetOnboardingProgress).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'CardOnboarding',
            params: { screen: 'CardOnboardingEmail' },
        })
        // Reset must happen before navigation so the next run starts clean.
        expect(
            mockResetOnboardingProgress.mock.invocationCallOrder[0],
        ).toBeLessThan(mockNavigate.mock.invocationCallOrder[0])
        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.OnboardingCreate)
    })

    it('handleAlreadyHaveAccount navigates to the sign-in screen', () => {
        const { result } = renderHook(() => usePeraCardIntroScreen())

        act(() => {
            result.current.handleAlreadyHaveAccount()
        })

        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'CardSignIn',
        })
        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.OnboardingRecover)
    })

    it('handleLearnMore opens the Pera Card learn-more url in a webview', () => {
        const { result } = renderHook(() => usePeraCardIntroScreen())

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://example.com/pera-card',
        })
        expect(mockOpenURL).not.toHaveBeenCalled()
    })

    it('handleLearnMore opens the url in a browser tab when inAppWebView is off (web)', () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        const { result } = renderHook(() => usePeraCardIntroScreen())

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockOpenURL).toHaveBeenCalledWith(
            'https://example.com/pera-card',
        )
        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})
