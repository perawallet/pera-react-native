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
import { WatchAccountScreen } from '../WatchAccountScreen'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
    }),
}))

const mockSetAccounts = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        useAccountsStore: (selector: (state: unknown) => unknown) => {
            const state = {
                setAccounts: mockSetAccounts,
                setSelectedAccountAddress: mockSetSelectedAccountAddress,
            }
            return selector(state)
        },
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        isValidAlgorandAddress: (address?: string) =>
            address === 'VALID_ALGORAND_ADDRESS',
    }
})

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('uuid', () => ({
    v7: () => 'mock-uuid',
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

describe('WatchAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    it('renders the screen title and description', () => {
        render(<WatchAccountScreen />)

        expect(screen.getByText('onboarding.watch_account.title')).toBeTruthy()
        expect(
            screen.getByText('onboarding.watch_account.description'),
        ).toBeTruthy()
    })

    it('renders the watch button', () => {
        render(<WatchAccountScreen />)

        expect(
            screen.getByText('onboarding.watch_account.watch_button'),
        ).toBeTruthy()
    })

    it('adds watch account when valid address is submitted', () => {
        render(<WatchAccountScreen />)

        const addressInput = screen.getByPlaceholderText(
            'onboarding.watch_account.address_placeholder',
        )
        fireEvent.change(addressInput, {
            target: { value: 'VALID_ALGORAND_ADDRESS' },
        })

        const watchButton = screen.getByText(
            'onboarding.watch_account.watch_button',
        )
        fireEvent.click(watchButton)

        expect(mockSetAccounts).toHaveBeenCalledWith([
            expect.objectContaining({
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
                canSign: false,
            }),
        ])
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'VALID_ALGORAND_ADDRESS',
        )
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'onboarding.watch_account.success_title',
            }),
        )
    })

    it('shows error for duplicate address', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                address: 'VALID_ALGORAND_ADDRESS',
                type: 'watch',
                canSign: false,
            } as WalletAccount,
        ])

        render(<WatchAccountScreen />)

        const addressInput = screen.getByPlaceholderText(
            'onboarding.watch_account.address_placeholder',
        )
        fireEvent.change(addressInput, {
            target: { value: 'VALID_ALGORAND_ADDRESS' },
        })

        const watchButton = screen.getByText(
            'onboarding.watch_account.watch_button',
        )
        fireEvent.click(watchButton)

        expect(mockSetAccounts).not.toHaveBeenCalled()
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
            }),
        )
    })
})
