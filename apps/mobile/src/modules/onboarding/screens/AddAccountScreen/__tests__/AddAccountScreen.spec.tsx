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
import { AddAccountScreen } from '../AddAccountScreen'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockNavigate = vi.fn()
const mockPush = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        push: mockPush,
        goBack: mockGoBack,
    }),
}))

const mockCreateAccount = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useCreateAccount: () => mockCreateAccount,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        deferToNextCycle: (callback: () => Promise<void>) => callback(),
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

describe('AddAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    it('renders the screen title and import option', () => {
        render(<AddAccountScreen />)

        expect(screen.getByText('onboarding.add_account.title')).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.add_account.import_account_option_title',
            ),
        ).toBeTruthy()
    })

    it('does not render Add Account option when no HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([])

        render(<AddAccountScreen />)

        expect(
            screen.queryByText(
                'onboarding.add_account.add_account_option_title',
            ),
        ).toBeNull()
    })

    it('renders Add Account option when HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'test-id',
                address: 'TEST_ADDRESS',
                type: 'hdWallet',
                canSign: true,
                hdWalletDetails: {
                    walletId: 'test-wallet-id',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
        ])

        render(<AddAccountScreen />)

        expect(
            screen.getByText('onboarding.add_account.add_account_option_title'),
        ).toBeTruthy()
    })

    it('navigates back when close button is pressed', () => {
        render(<AddAccountScreen />)

        const closeButton = screen.getByTestId('add_account_close_button')
        fireEvent.click(closeButton)

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it('opens ImportOptionsBottomSheet when Import Account is pressed', () => {
        render(<AddAccountScreen />)

        const importButton = screen.getByText(
            'onboarding.add_account.import_account_option_title',
        )
        fireEvent.click(importButton)

        expect(screen.getByText('onboarding.import_options.title')).toBeTruthy()
    })

    it('navigates to ImportInfo when HD Wallet import option is selected', () => {
        render(<AddAccountScreen />)

        const importButton = screen.getByText(
            'onboarding.add_account.import_account_option_title',
        )
        fireEvent.click(importButton)

        const hdWalletOption = screen.getByText(
            'onboarding.import_options.hd_wallet.title',
        )
        fireEvent.click(hdWalletOption)

        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'hdWallet',
        })
    })

    it('navigates to ImportInfo when Algo25 import option is selected', () => {
        render(<AddAccountScreen />)

        const importButton = screen.getByText(
            'onboarding.add_account.import_account_option_title',
        )
        fireEvent.click(importButton)

        const algo25Option = screen.getByText(
            'onboarding.import_options.algo25.title',
        )
        fireEvent.click(algo25Option)

        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'algo25',
        })
    })

    it('navigates to WatchAccount when Watch an Address is pressed', () => {
        render(<AddAccountScreen />)

        const watchButton = screen.getByText(
            'onboarding.add_account.watch_address_option_title',
        )
        fireEvent.click(watchButton)

        expect(mockPush).toHaveBeenCalledWith('WatchAccount')
    })

    it('creates a new HD wallet when Create Universal Wallet is pressed', async () => {
        const mockAccount = {
            id: 'new-wallet-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
            hdWalletDetails: {
                walletId: 'new-wallet-id',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }

        mockCreateAccount.mockResolvedValue(mockAccount)

        render(<AddAccountScreen />)

        const createButton = screen.getByText(
            'onboarding.add_account.create_universal_wallet_option_title',
        )
        fireEvent.click(createButton)

        await vi.waitFor(() => {
            expect(mockCreateAccount).toHaveBeenCalledWith({
                account: 0,
                keyIndex: 0,
            })
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: mockAccount,
            })
        })
    })

    it('creates a new Algo25 account when Create Algo25 is pressed', async () => {
        const mockAccount = {
            id: 'algo25-id',
            address: 'ALGO25_ADDRESS',
            type: 'algo25' as const,
            canSign: true,
        }

        mockCreateAccount.mockResolvedValue(mockAccount)

        render(<AddAccountScreen />)

        const createButton = screen.getByText(
            'onboarding.add_account.create_algo25_option_title',
        )
        fireEvent.click(createButton)

        await vi.waitFor(() => {
            expect(mockCreateAccount).toHaveBeenCalledWith({
                account: 0,
                keyIndex: 0,
                type: 'algo25',
            })
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: mockAccount,
            })
        })
    })

    it('derives new address from existing HD wallet when Add Account is pressed', async () => {
        const existingAccount = {
            id: 'existing-id',
            address: 'EXISTING_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
            hdWalletDetails: {
                walletId: 'wallet-1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9 as const,
            },
        }

        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
            hdWalletDetails: {
                walletId: 'wallet-1',
                account: 0,
                change: 0,
                keyIndex: 1,
                derivationType: 9 as const,
            },
        }

        mockUseAllAccounts.mockReturnValue([existingAccount])
        mockCreateAccount.mockResolvedValue(newAccount)

        render(<AddAccountScreen />)

        const addButton = screen.getByText(
            'onboarding.add_account.add_account_option_title',
        )
        fireEvent.click(addButton)

        await vi.waitFor(() => {
            expect(mockCreateAccount).toHaveBeenCalledWith({
                walletId: 'wallet-1',
                account: 0,
                keyIndex: 1,
            })
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: newAccount,
            })
        })
    })

    it('shows error toast when account creation fails', async () => {
        mockCreateAccount.mockRejectedValue(new Error('Creation failed'))

        render(<AddAccountScreen />)

        const createButton = screen.getByText(
            'onboarding.add_account.create_universal_wallet_option_title',
        )
        fireEvent.click(createButton)

        await vi.waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                }),
            )
        })
    })
})
