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
import { usePeraCardIntroScreen } from '../usePeraCardIntroScreen'

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
    })

    it('handleAlreadyHaveAccount surfaces the coming-soon info toast', () => {
        const { result } = renderHook(() => usePeraCardIntroScreen())

        act(() => {
            result.current.handleAlreadyHaveAccount()
        })

        expect(mockInfoToast).toHaveBeenCalledWith(
            'peraCard.intro.coming_soon_title',
            'peraCard.intro.coming_soon_body',
        )
    })

    it('handleLearnMore opens the Pera Card learn-more url in a webview', () => {
        const { result } = renderHook(() => usePeraCardIntroScreen())

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://example.com/pera-card',
        })
    })
})
