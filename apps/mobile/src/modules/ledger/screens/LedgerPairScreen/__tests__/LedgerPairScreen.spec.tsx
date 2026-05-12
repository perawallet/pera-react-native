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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'

const { mockNavigate, mockOpenURL, mockSetOptions } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    // The real Linking.openURL returns a Promise; match that so the
    // hook's `.catch` handler can attach.
    mockOpenURL: vi.fn(() => Promise.resolve()),
    mockSetOptions: vi.fn(),
}))

vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<typeof import('react-native')>()
    return {
        ...actual,
        Linking: { openURL: mockOpenURL },
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<
        typeof import('@react-navigation/native')
    >('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({
            setOptions: mockSetOptions,
        }),
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { LedgerPairScreen } from '../LedgerPairScreen'

describe('LedgerPairScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the title, description, and CTAs', () => {
        render(<LedgerPairScreen />)

        expect(screen.getByText('ledger.pair.title')).toBeTruthy()
        expect(screen.getByText('ledger.pair.description')).toBeTruthy()
        expect(screen.getByText('ledger.pair.cta')).toBeTruthy()
        expect(screen.getByText('ledger.pair.how_does_it_work')).toBeTruthy()
    })

    it('navigates to LedgerScan when the primary CTA is pressed', () => {
        render(<LedgerPairScreen />)

        fireEvent.click(screen.getByText('ledger.pair.cta'))

        expect(mockNavigate).toHaveBeenCalledWith('LedgerScan')
    })

    it('opens the support URL when the header-right info button is pressed', () => {
        render(<LedgerPairScreen />)

        const lastCall = mockSetOptions.mock.calls.at(-1)?.[0]
        const headerRight = lastCall?.headerRight?.()

        render(headerRight as React.ReactElement)

        fireEvent.click(screen.getByTestId('ledger_pair_info_button'))

        expect(mockOpenURL).toHaveBeenCalledWith('ledger.pair.support_url')
    })
})
