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
import { WatchInfoScreen } from '../WatchInfoScreen'
import { WATCH_ACCOUNT_SUPPORT_URL } from '@perawallet/wallet-core-config'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

const mockGoBack = vi.fn()
const mockPush = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        push: mockPush,
    }),
}))

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

vi.mock('@assets/images/eye.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) => {
        return React.createElement('div', {
            ...props,
            'data-testid': 'eye-svg',
        })
    },
}))

vi.mock('@assets/images/eye-inverted.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) => {
        return React.createElement('div', {
            ...props,
            'data-testid': 'eye-inverted-svg',
        })
    },
}))

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

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

describe('WatchInfoScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders title, description, warning, and button', () => {
        render(<WatchInfoScreen />)

        expect(
            screen.getByText('onboarding.watch_account.info_title'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.watch_account.info_description'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.watch_account.info_warning'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.watch_account.info_button'),
        ).toBeTruthy()
    })

    it('sets up header with info button via useNavigationHeader', () => {
        render(<WatchInfoScreen />)

        expect(useNavigationHeader).toHaveBeenCalledWith(
            expect.objectContaining({
                right: expect.anything(),
            }),
        )
    })

    it('navigates to WatchAccount when primary button is pressed', () => {
        render(<WatchInfoScreen />)

        const createButton = screen.getByText(
            'onboarding.watch_account.info_button',
        )
        fireEvent.click(createButton)

        expect(mockPush).toHaveBeenCalledWith('WatchAccount')
    })

    it('handles info button press via headerRight', () => {
        render(<WatchInfoScreen />)

        const hookCall = (useNavigationHeader as ReturnType<typeof vi.fn>).mock
            .calls[0][0]
        const rightElement = hookCall.right

        const { getByTestId } = render(rightElement)
        fireEvent.click(getByTestId('info-button'))

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: WATCH_ACCOUNT_SUPPORT_URL,
        })
    })
})
