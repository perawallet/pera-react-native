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

import { renderHook, waitFor } from '@test-utils/render'
import { vi } from 'vitest'
import { useSearchAccountsScreen } from '../useSearchAccountsScreen'
import { AccountTypes } from '@perawallet/wallet-core-accounts'

const {
    mockShowToast,
    mockGoBack,
    mockReplace,
    mockDiscoverAccounts,
    mockDiscoverRekeyedAccounts,
    mockExitAccountFlow,
    mockSetSelectedAccountAddress,
    mockCreateHdWalletAccount,
    mockAllAccounts,
    mockRouteParams,
} = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockGoBack: vi.fn(),
    mockReplace: vi.fn(),
    mockDiscoverAccounts: vi.fn(),
    mockDiscoverRekeyedAccounts: vi.fn(),
    mockExitAccountFlow: vi.fn(),
    mockSetSelectedAccountAddress: vi.fn(),
    mockCreateHdWalletAccount: vi.fn(),
    mockAllAccounts: { current: [] as unknown[] },
    mockRouteParams: {
        current: {
            account: {
                id: '1',
                address: 'MOCK_ADDRESS',
                type: 'hdWallet' as const,
                keyPairId: 'wallet-1',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
            createIfEmpty: undefined as boolean | undefined,
        },
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({}),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountDiscovery: () => ({
        discoverAccounts: mockDiscoverAccounts,
        discoverRekeyedAccounts: mockDiscoverRekeyedAccounts,
    }),
    useSelectedAccountAddress: () => ({
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    useCreateAccount: () => ({
        createHdWalletAccount: mockCreateHdWalletAccount,
    }),
    useAllAccounts: () => mockAllAccounts.current,
}))

vi.mock('../../../hooks', () => ({
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: vi.fn(),
            },
        },
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: mockRouteParams.current,
    }),
}))

describe('useSearchAccountsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default success mocks
        mockDiscoverAccounts.mockResolvedValue([])
        mockDiscoverRekeyedAccounts.mockResolvedValue([])
        mockAllAccounts.current = []
        mockRouteParams.current = {
            account: {
                id: '1',
                address: 'MOCK_ADDRESS',
                type: 'hdWallet' as const,
                keyPairId: 'wallet-1',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
            createIfEmpty: undefined,
        }
    })

    it('navigates back and shows toast on error', async () => {
        mockDiscoverAccounts.mockRejectedValue(new Error('Search failed'))

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith({
                type: 'error',
                title: 'onboarding.import_account.failed_title',
                body: 'onboarding.import_account.failed_body',
            })
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    it('navigates to ImportSelectAddresses on success', async () => {
        mockDiscoverAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportSelectAddresses', {
                accounts: expect.any(Array),
            })
        })
    })

    it('selects the imported account, scans for rekeyed accounts, and exits when only one HD account is discovered with no rekeys', async () => {
        const singleAccount = {
            id: '1',
            address: 'MOCK_ADDRESS',
            type: AccountTypes.hdWallet,
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverRekeyedAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
                'MOCK_ADDRESS',
            )
            expect(mockDiscoverRekeyedAccounts).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountAddresses: ['MOCK_ADDRESS'],
                }),
            )
            expect(mockExitAccountFlow).toHaveBeenCalled()
        })
    })

    it('navigates to ImportRekeyedAddresses when single HD account has rekeyed accounts', async () => {
        const singleAccount = {
            id: '1',
            address: 'MOCK_ADDRESS',
            type: AccountTypes.hdWallet,
        }
        const rekeyedAccounts = [
            {
                account: {
                    id: 'rekeyed-1',
                    address: 'REKEYED_ADDRESS',
                    type: AccountTypes.watch,
                },
                authAddress: 'MOCK_ADDRESS',
            },
        ]
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverRekeyedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
            })
            expect(mockExitAccountFlow).not.toHaveBeenCalled()
        })
    })

    it('creates next derivation and navigates to NameAccount when createIfEmpty without scanning for rekeys', async () => {
        mockRouteParams.current.createIfEmpty = true
        mockAllAccounts.current = [
            {
                id: '1',
                address: 'MOCK_ADDRESS',
                type: 'hdWallet' as const,
                keyPairId: 'wallet-1',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
        ]

        const singleAccount = {
            id: '1',
            address: 'MOCK_ADDRESS',
            type: AccountTypes.hdWallet,
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])

        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
        }
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
                walletId: 'wallet-1',
                account: 0,
                keyIndex: 1,
            })
            expect(mockDiscoverRekeyedAccounts).not.toHaveBeenCalled()
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: newAccount,
            })
        })

        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    it('shows error toast and goes back when createIfEmpty account creation fails', async () => {
        mockRouteParams.current.createIfEmpty = true
        mockAllAccounts.current = [
            {
                id: '1',
                address: 'MOCK_ADDRESS',
                type: 'hdWallet' as const,
                keyPairId: 'wallet-1',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
        ]

        const singleAccount = {
            id: '1',
            address: 'MOCK_ADDRESS',
            type: AccountTypes.hdWallet,
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
            expect(mockGoBack).toHaveBeenCalled()
        })
    })
})
