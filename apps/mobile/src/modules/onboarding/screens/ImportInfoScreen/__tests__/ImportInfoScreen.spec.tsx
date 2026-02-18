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
import { RECOVERY_PASSPHRASE_SUPPORT_URL } from '@perawallet/wallet-core-config'
import { useScreenHeader } from '@hooks/useScreenHeader'

// Mock navigation
const mockGoBack = vi.fn()
const mockPush = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        push: mockPush,
    }),
}))

// Note: useAppNavigation mock is still needed by useImportInfoScreen hook

vi.mock('@hooks/useScreenHeader', () => ({
    useScreenHeader: vi.fn(),
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

// Use global mock from vitest.setup.ts - no override needed

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

    it('sets up header with info button via useScreenHeader', () => {
        render(<ImportInfoScreen />)

        expect(useScreenHeader).toHaveBeenCalledWith(
            expect.objectContaining({
                right: expect.anything(),
            }),
        )
    })

    it('navigates to ImportAccount when recover button is pressed', () => {
        render(<ImportInfoScreen />)

        const recoverButton = screen.getByText('onboarding.import_info.button')
        fireEvent.click(recoverButton)

        expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
            accountType: 'hdWallet',
        })
    })

    it('handles info button press via headerRight', () => {
        render(<ImportInfoScreen />)

        // Extract the right element from useScreenHeader call
        const hookCall = (useScreenHeader as ReturnType<typeof vi.fn>).mock
            .calls[0][0]
        const rightElement = hookCall.right

        // Render the right element and click it
        const { getByTestId } = render(rightElement)
        fireEvent.click(getByTestId('info-button'))

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: RECOVERY_PASSPHRASE_SUPPORT_URL,
        })
    })
})
