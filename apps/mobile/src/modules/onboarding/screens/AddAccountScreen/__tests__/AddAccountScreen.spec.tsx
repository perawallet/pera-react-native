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

const mockCreateHdWalletAccount = vi.fn()
const mockCreateAlgo25WalletAccount = vi.fn()
const mockCreateNextHDAccount = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useCreateAccount: () => ({
            createHdWalletAccount: mockCreateHdWalletAccount,
            createAlgo25WalletAccount: mockCreateAlgo25WalletAccount,
        }),
        useAllAccounts: () => mockUseAllAccounts(),
        useCreateNextHDAccount: () => ({
            createNextHDAccount: mockCreateNextHDAccount,
            hasHDWallet: mockUseAllAccounts().some(
                (a: WalletAccount) => a.type === 'hdWallet',
            ),
        }),
        useHDWalletGroups: () => ({
            hdWalletGroups: [],
            hasMultipleHDWallets: false,
        }),
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

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-config',
    )
    return {
        ...actual,
        config: {
            termsOfServiceUrl: 'https://example.com/terms',
            privacyPolicyUrl: 'https://example.com/privacy',
        },
    }
})

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        parseDeeplink: vi.fn(),
        handleDeepLink: vi.fn(),
        isValidDeepLink: vi.fn(),
        buildAccountDeeplink: vi.fn(),
    }),
}))

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
                By adding a wallet, you agree to Pera Wallet&apos;s
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
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
                keyPairId: 'wallet-1',
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

    it('navigates to ImportAccountOptions when Import Account is pressed', () => {
        render(<AddAccountScreen />)

        const importButton = screen.getByText(
            'onboarding.add_account.import_account_option_title',
        )
        fireEvent.click(importButton)

        expect(mockPush).toHaveBeenCalledWith('ImportAccountOptions')
    })

    it('does not render Pair Ledger or Scan QR options on the main screen', () => {
        render(<AddAccountScreen />)

        expect(
            screen.queryByText(
                'onboarding.add_account.pair_ledger_option_title',
            ),
        ).toBeNull()
        expect(
            screen.queryByText('onboarding.add_account.scan_qr_option_title'),
        ).toBeNull()
    })

    it('navigates to WatchInfo when Watch an Address is pressed', () => {
        mockUseAllAccounts.mockReturnValue([])

        render(<AddAccountScreen />)

        const toggleButton = screen.getByTestId(
            'add_account_see_other_options_button',
        )
        fireEvent.click(toggleButton)

        const watchButton = screen.getByText(
            'onboarding.add_account.watch_address_option_title',
        )
        fireEvent.click(watchButton)

        expect(mockPush).toHaveBeenCalledWith('WatchInfo')
    })

    it('creates a new HD wallet when Create Universal Wallet is pressed (no HD wallet)', async () => {
        mockUseAllAccounts.mockReturnValue([])

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

        mockCreateHdWalletAccount.mockResolvedValue(mockAccount)

        render(<AddAccountScreen />)

        const createButton = screen.getByText(
            'onboarding.add_account.create_universal_wallet_option_title',
        )
        fireEvent.click(createButton)

        await vi.waitFor(() => {
            expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
                account: 0,
                keyIndex: 0,
            })
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: mockAccount,
            })
        })
    })

    it('creates a new HD wallet when Create Universal Wallet is pressed (has HD wallet)', async () => {
        const mockAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateHdWalletAccount.mockResolvedValue(mockAccount)

        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing-id',
                address: 'EXISTING_ADDRESS',
                type: 'hdWallet' as const,
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9 as const,
                },
                keyPairId: 'wallet-1',
            },
        ])

        render(<AddAccountScreen />)

        const toggleButton = screen.getByTestId(
            'add_account_see_other_options_button',
        )
        fireEvent.click(toggleButton)

        const createButton = screen.getByText(
            'onboarding.add_account.create_universal_wallet_option_title',
        )
        fireEvent.click(createButton)

        await vi.waitFor(() => {
            expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
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

        mockCreateAlgo25WalletAccount.mockResolvedValue(mockAccount)

        render(<AddAccountScreen />)

        const toggleButton = screen.getByTestId(
            'add_account_see_other_options_button',
        )
        fireEvent.click(toggleButton)

        const createButton = screen.getByText(
            'onboarding.add_account.create_algo25_option_title',
        )
        fireEvent.click(createButton)

        await vi.waitFor(() => {
            expect(mockCreateAlgo25WalletAccount).toHaveBeenCalledWith({})
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
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9 as const,
            },
            keyPairId: 'wallet-1',
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
        mockCreateNextHDAccount.mockResolvedValue(newAccount)

        render(<AddAccountScreen />)

        const addButton = screen.getByText(
            'onboarding.add_account.add_account_option_title',
        )
        fireEvent.click(addButton)

        await vi.waitFor(() => {
            expect(mockCreateNextHDAccount).toHaveBeenCalled()
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: newAccount,
            })
        })
    })

    it('shows error toast when account creation fails', async () => {
        mockUseAllAccounts.mockReturnValue([])
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

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

    it('hides secondary options by default when no HD wallet (Create Universal Wallet in main)', () => {
        mockUseAllAccounts.mockReturnValue([])

        render(<AddAccountScreen />)

        expect(
            screen.getByTestId('add_account_see_other_options_button'),
        ).toBeTruthy()

        // Create Universal Wallet is visible in main options
        expect(
            screen.getByText(
                'onboarding.add_account.create_universal_wallet_option_title',
            ),
        ).toBeTruthy()

        // These are hidden behind "see other options"
        expect(
            screen.queryByText(
                'onboarding.add_account.watch_address_option_title',
            ),
        ).toBeNull()
        expect(
            screen.queryByText(
                'onboarding.add_account.create_algo25_option_title',
            ),
        ).toBeNull()
    })

    it('hides secondary options by default when HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing-id',
                address: 'EXISTING_ADDRESS',
                type: 'hdWallet' as const,
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9 as const,
                },
                keyPairId: 'wallet-1',
            },
        ])

        render(<AddAccountScreen />)

        expect(
            screen.getByTestId('add_account_see_other_options_button'),
        ).toBeTruthy()

        expect(
            screen.queryByText(
                'onboarding.add_account.watch_address_option_title',
            ),
        ).toBeNull()
        expect(
            screen.queryByText(
                'onboarding.add_account.create_universal_wallet_option_title',
            ),
        ).toBeNull()
        expect(
            screen.queryByText(
                'onboarding.add_account.create_algo25_option_title',
            ),
        ).toBeNull()
    })

    it('reveals secondary options when See other options is pressed (no HD wallet)', () => {
        mockUseAllAccounts.mockReturnValue([])

        render(<AddAccountScreen />)

        const toggleButton = screen.getByTestId(
            'add_account_see_other_options_button',
        )
        fireEvent.click(toggleButton)

        expect(
            screen.getByText(
                'onboarding.add_account.watch_address_option_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.add_account.create_algo25_option_title',
            ),
        ).toBeTruthy()

        // Create Universal Wallet should NOT be in the expanded section (it's in main)
        // It's still visible on screen (in main options), but only watch + algo25 were added
        expect(
            screen.queryByTestId('add_account_see_other_options_button'),
        ).toBeNull()
    })

    it('reveals secondary options when See other options is pressed (has HD wallet)', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing-id',
                address: 'EXISTING_ADDRESS',
                type: 'hdWallet' as const,
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9 as const,
                },
                keyPairId: 'wallet-1',
            },
        ])

        render(<AddAccountScreen />)

        const toggleButton = screen.getByTestId(
            'add_account_see_other_options_button',
        )
        fireEvent.click(toggleButton)

        expect(
            screen.getByText(
                'onboarding.add_account.watch_address_option_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.add_account.create_universal_wallet_option_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.add_account.create_algo25_option_title',
            ),
        ).toBeTruthy()

        expect(
            screen.queryByTestId('add_account_see_other_options_button'),
        ).toBeNull()
    })

    it('renders footer with terms and privacy text', () => {
        render(<AddAccountScreen />)

        expect(screen.getByText('Terms and Conditions')).toBeTruthy()
        expect(screen.getByText('Privacy Policy')).toBeTruthy()
    })
})
