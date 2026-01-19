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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnboardingScreen } from '../OnboardingScreen'
import { config } from '@perawallet/wallet-core-config'

// Mock store functions
const mockSetIsCreatingAccount = vi.fn()

vi.mock('@modules/onboarding/hooks', () => ({
    useIsCreatingAccount: () => ({
        isCreatingAccount: false,
        setIsCreatingAccount: mockSetIsCreatingAccount,
    }),
}))

// Mock navigation
const mockSetOptions = vi.fn()
const mockNavigate = vi.fn()
const mockPush = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        setOptions: mockSetOptions,
        navigate: mockNavigate,
        push: mockPush,
    }),
}))

// Mock webview
const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

// Mock core components to handle onPress in DOM environment
vi.mock('@components/core', async () => {
    const actual =
        await vi.importActual<typeof import('@components/core')>(
            '@components/core',
        )
    const React = await import('react')
    return {
        ...actual,
        PWText: ({
            children,
            onPress,
            ...props
        }: {
            children?: React.ReactNode
            onPress?: () => void
        }) => {
            // Map onPress to onClick for testing interactions
            return React.createElement(
                'span',
                { ...props, onClick: onPress },
                children,
            )
        },
    }
})

// Mock react-i18next
vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    const React = await import('react')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: {
                changeLanguage: vi.fn(),
                language: 'en',
            },
        }),
        Trans: ({
            components,
        }: {
            components: React.ReactElement<React.PropsWithChildren<unknown>>[]
        }) => (
            <>
                By creating a wallet, you agree to Pera Wallet&apos;s
                {React.cloneElement(components[0], {
                    children: 'Terms and Conditions',
                })}
                and
                {React.cloneElement(components[1], {
                    children: 'Privacy Policy',
                })}
            </>
        ),
    }
})

describe('OnboardingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        render(<OnboardingScreen />)

        expect(screen.getByText('onboarding.main_screen.welcome')).toBeTruthy()
        expect(
            screen.getByText('onboarding.main_screen.new_to_algo'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.main_screen.create_wallet'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.main_screen.already_have_account'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.main_screen.import_account'),
        ).toBeTruthy()
    })

    it('opens terms of service when link is pressed', () => {
        render(<OnboardingScreen />)

        const termsLink = screen.getByText('Terms and Conditions')
        fireEvent.click(termsLink)

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.termsOfServiceUrl,
            id: 'terms-of-service',
        })
    })

    it('opens privacy policy when link is pressed', () => {
        render(<OnboardingScreen />)

        const privacyLink = screen.getByText('Privacy Policy')
        fireEvent.click(privacyLink)

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: config.privacyPolicyUrl,
            id: 'privacy-policy',
        })
    })
    it('navigates to NameAccount when Create Wallet is pressed', () => {
        render(<OnboardingScreen />)

        const createButton = screen.getByText(
            'onboarding.main_screen.create_wallet',
        )
        // Buttons might fail to find by text if nested complex structure, but let's try
        // The PanelButton likely renders text.
        fireEvent.click(createButton)

        expect(mockPush).toHaveBeenCalledWith('NameAccount')
        expect(mockSetIsCreatingAccount).toHaveBeenCalledWith(true)
    })

    it('navigates to ImportAccount when Import Account is pressed', () => {
        render(<OnboardingScreen />)

        const importButton = screen.getByText(
            'onboarding.main_screen.import_account',
        )
        fireEvent.click(importButton)

        expect(mockPush).toHaveBeenCalledWith('ImportAccount')
        expect(mockSetIsCreatingAccount).toHaveBeenCalledWith(true)
    })
})
