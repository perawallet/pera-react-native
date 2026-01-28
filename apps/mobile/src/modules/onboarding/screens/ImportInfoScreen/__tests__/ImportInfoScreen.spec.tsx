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

import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportInfoScreen } from '../ImportInfoScreen'

// Mock navigation
const mockGoBack = vi.fn()
const mockPush = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        push: mockPush,
    }),
}))

vi.mock('@assets/images/key.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) => {
        return React.createElement('div', {
            ...props,
            'data-testid': 'key-svg',
        })
    },
}))

vi.mock('@assets/images/key-inverted.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) => {
        return React.createElement('div', {
            ...props,
            'data-testid': 'key-inverted-svg',
        })
    },
}))

// Mock react-i18next
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

vi.mock('@components/core', async () => {
    const actual =
        await vi.importActual<typeof import('@components/core')>(
            '@components/core',
        )
    const React = await import('react')
    return {
        ...actual,
        PWTouchableOpacity: ({
            children,
            onPress,
            testID,
            ...props
        }: {
            children?: React.ReactNode
            onPress?: () => void
            testID?: string
        }) => {
            return React.createElement(
                'div',
                { ...props, onClick: onPress, 'data-testid': testID },
                children,
            )
        },
        PWText: ({
            children,
            onPress,
            ...props
        }: {
            children?: React.ReactNode
            onPress?: () => void
        }) => {
            return React.createElement(
                'span',
                { ...props, onClick: onPress },
                children,
            )
        },
    }
})

// Mock react-navigation
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({
            params: { accountType: 'hdWallet' },
        }),
    }
})

// Mock webview
const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

describe('ImportInfoScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        render(<ImportInfoScreen />)

        expect(screen.getByText('onboarding.import_info.title')).toBeTruthy()
        expect(screen.getByText('onboarding.import_info.body')).toBeTruthy()
        expect(screen.getByText('onboarding.import_info.button')).toBeTruthy()
    })

    it('navigates back when back button is pressed', () => {
        render(<ImportInfoScreen />)

        const backButton = screen.getByTestId('back-button')
        fireEvent.click(backButton)

        expect(mockGoBack).toHaveBeenCalled()
    })

    it('navigates to ImportAccount when recover button is pressed', () => {
        render(<ImportInfoScreen />)

        const recoverButton = screen.getByText('onboarding.import_info.button')
        fireEvent.click(recoverButton)

        expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
            accountType: 'hdWallet',
        })
    })

    it('handles info button press', () => {
        render(<ImportInfoScreen />)

        const infoButton = screen.getByTestId('info-button')
        fireEvent.click(infoButton)

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/recover-or-import-an-algorand-account-with-recovery-passphrase-11gdh1y/',
        })
    })
})
