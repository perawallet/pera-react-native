/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import type { SearchAccountsParams } from '../../../routes/types'

const {
    mockShowToast,
    mockGoBack,
    mockReplace,
    mockDiscoverAccounts,
    mockDiscoverDelegatedAccounts,
    mockDiscoverImportAccounts,
    mockCancelImport,
    mockExitAccountFlow,
    mockSetShouldPlayConfetti,
    mockSetSelectedAccountId,
    mockBuildHdWalletAccount,
    mockAllAccounts,
    mockRouteParams,
} = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockGoBack: vi.fn(),
    mockReplace: vi.fn(),
    mockDiscoverAccounts: vi.fn(),
    mockDiscoverDelegatedAccounts: vi.fn(),
    mockDiscoverImportAccounts: vi.fn(),
    mockCancelImport: vi.fn(),
    mockExitAccountFlow: vi.fn(),
    mockSetShouldPlayConfetti: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockBuildHdWalletAccount: vi.fn(),
    mockAllAccounts: { current: [] as unknown[] },
    mockRouteParams: {
        current: {
            account: {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
            createIfEmpty: undefined as boolean | undefined,
            notifyOnEmpty: undefined as boolean | undefined,
        } as SearchAccountsParams,
    },
}))

vi.mock('@hooks/useLanguage')

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
    // useSearchAccountsScreen walks child→seed via seedIdOf to derive the
    // walletKeyId it hands to the discovery API. Tests pre-stamp accounts
    // with `keyPairId = 'wallet-1'` (used as a seed id directly) so map
    // identity → identity for this test surface.
    useKMS: () => ({
        seedIdOf: (childId?: string) => childId,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountDiscovery: () => ({
        discoverAccounts: mockDiscoverAccounts,
        discoverDelegatedAccounts: mockDiscoverDelegatedAccounts,
    }),
    useHDImportSession: () => ({
        prepareImport: vi.fn(),
        discoverImportAccounts: mockDiscoverImportAccounts,
        commitImport: vi.fn(),
        cancelImport: mockCancelImport,
    }),
    useSelectedAccountId: () => ({
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
    useCreateAccount: () => ({
        buildHdWalletAccount: mockBuildHdWalletAccount,
    }),
    useAllAccounts: () => mockAllAccounts.current,
}))

vi.mock('../../../hooks', () => ({
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
    }),
    useShouldPlayConfetti: () => ({
        setShouldPlayConfetti: mockSetShouldPlayConfetti,
    }),
    // Mirrors the real useDelegationScanNoticeResult: swallow discoverDelegatedAccounts
    // failures into the sentinel instead of letting them throw.
    useDelegationScanNoticeResult: () => ({
        scanRekeyed: async (accountAddresses: string[]) => {
            try {
                return await mockDiscoverDelegatedAccounts({ accountAddresses })
            } catch {
                mockShowToast({
                    type: 'info',
                    title: 'onboarding.searching_accounts.rekey_scan_failed_title',
                    body: 'onboarding.searching_accounts.rekey_scan_failed_body',
                })
                return 'rekey-scan-unavailable'
            }
        },
    }),
    REKEY_SCAN_UNAVAILABLE: 'rekey-scan-unavailable',
}))

vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', () => ({
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: vi.fn(),
            },
        },
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
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
        mockDiscoverDelegatedAccounts.mockResolvedValue([])
        mockAllAccounts.current = []
        mockRouteParams.current = {
            account: {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
            createIfEmpty: undefined,
            notifyOnEmpty: undefined,
        } as SearchAccountsParams
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
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverDelegatedAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
            expect(mockExitAccountFlow).toHaveBeenCalled()
        })
    })

    it('navigates to ImportRekeyedAddresses when single HD account has rekeyed accounts', async () => {
        const singleAccount = {
            id: '1',
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        const rekeyedAccounts = [
            {
                id: 'rekeyed-1',
                chains: { algorand: { address: 'REKEYED_ADDRESS' } },
                custody: { kind: 'watch' },
            },
        ]
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverDelegatedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
            })
        })
    })

    it('creates next derivation and navigates to NameAccount when createIfEmpty without scanning for rekeys', async () => {
        mockRouteParams.current = {
            account: {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
            createIfEmpty: true,
        } as SearchAccountsParams
        mockAllAccounts.current = [
            {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
        ]

        const singleAccount = {
            id: '1',
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])

        const newAccount = {
            id: 'new-id',
            chains: { algorand: { address: 'NEW_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
                walletId: 'wallet-1',
                account: 0,
                keyIndex: 1,
            })
            expect(mockDiscoverDelegatedAccounts).not.toHaveBeenCalled()
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: newAccount,
            })
        })

        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    it('shows "no new addresses" toast and exits when notifyOnEmpty is true and only the master HD account is discovered with no rekeys', async () => {
        ;(
            mockRouteParams.current as Extract<
                SearchAccountsParams,
                { account: unknown }
            >
        ).notifyOnEmpty = true
        const singleAccount = {
            id: '1',
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverDelegatedAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith({
                type: 'info',
                title: 'onboarding.searching_accounts.no_new_addresses_title',
                body: 'onboarding.searching_accounts.no_new_addresses_body',
            })
            expect(mockExitAccountFlow).toHaveBeenCalled()
            expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
            expect(mockReplace).not.toHaveBeenCalled()
        })
    })

    it('does not show "no new addresses" toast when notifyOnEmpty is true but rekeyed accounts are found', async () => {
        ;(
            mockRouteParams.current as Extract<
                SearchAccountsParams,
                { account: unknown }
            >
        ).notifyOnEmpty = true
        const singleAccount = {
            id: '1',
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        const rekeyedAccounts = [
            {
                id: 'rekeyed-1',
                chains: { algorand: { address: 'REKEYED_ADDRESS' } },
                custody: { kind: 'watch' },
            },
        ]
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverDelegatedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
            })
        })
        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    it('shows error toast and goes back when createIfEmpty account creation fails', async () => {
        mockRouteParams.current = {
            account: {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
            createIfEmpty: true,
        } as SearchAccountsParams
        mockAllAccounts.current = [
            {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
        ]

        const singleAccount = {
            id: '1',
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    it('in import mode, always navigates to ImportSelectAddresses with the discovered accounts', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        const discovered = [
            {
                id: '1',
                chains: { algorand: { address: 'CBLW...', keyPairId: 'w-1' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 1, keyIndex: 0 },
                },
            },
        ]
        mockDiscoverImportAccounts.mockResolvedValue(discovered)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportSelectAddresses', {
                mode: 'import',
                walletKeyId: 'w-1',
                accounts: discovered,
            })
            expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
            expect(mockCancelImport).not.toHaveBeenCalled()
        })
    })

    it('in import mode, on empty discovery cancels the import session and goes back', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        mockDiscoverImportAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockCancelImport).toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith({
                type: 'error',
                title: 'onboarding.import_account.failed_title',
                body: 'onboarding.import_account.failed_body',
            })
            expect(mockGoBack).toHaveBeenCalled()
            expect(mockReplace).not.toHaveBeenCalled()
        })
    })

    it('in import mode, on discovery error cancels the import session and goes back', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        mockDiscoverImportAccounts.mockRejectedValue(new Error('boom'))

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockCancelImport).toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith({
                type: 'error',
                title: 'onboarding.import_account.failed_title',
                body: 'onboarding.import_account.failed_body',
            })
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    it('algo25 account with no rekeyed: navigates to NameAccount to let the user name the import', async () => {
        const algo25Account = {
            id: '1',
            chains: {
                algorand: { address: 'PARENT_ADDRESS', keyPairId: 'wallet-1' },
            },
            custody: { kind: 'local', seed: null },
        }
        mockRouteParams.current = {
            account: algo25Account,
            createIfEmpty: undefined,
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: algo25Account,
            })
        })
        // Naming, confetti and exit are deferred to NameAccount on confirm.
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
        expect(mockSetShouldPlayConfetti).not.toHaveBeenCalled()
    })

    it('algo25 account with rekeyed: selects the parent before navigating to ImportRekeyedAddresses', async () => {
        const algo25Account = {
            id: '1',
            chains: {
                algorand: { address: 'PARENT_ADDRESS', keyPairId: 'wallet-1' },
            },
            custody: { kind: 'local', seed: null },
        }
        const rekeyedAccounts = [
            {
                id: 'rekeyed-1',
                chains: { algorand: { address: 'REKEYED_1' } },
                custody: { kind: 'local', seed: null },
            },
        ]
        mockRouteParams.current = {
            account: algo25Account,
            createIfEmpty: undefined,
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
            })
            expect(mockExitAccountFlow).not.toHaveBeenCalled()
        })
    })

    it('quantum account with no rekeyed: moves on to NameAccount instead of hanging on the search step', async () => {
        const quantumAccount = {
            id: '1',
            chains: {
                algorand: { address: 'PARENT_ADDRESS', keyPairId: 'wallet-1' },
            },
            custody: { kind: 'local', seed: 'quantum' },
        }
        mockRouteParams.current = {
            account: quantumAccount,
            createIfEmpty: undefined,
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: quantumAccount,
            })
        })
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
        expect(mockSetShouldPlayConfetti).not.toHaveBeenCalled()
    })

    it('quantum account with rekeyed: selects the parent before navigating to ImportRekeyedAddresses', async () => {
        const quantumAccount = {
            id: '1',
            chains: {
                algorand: { address: 'PARENT_ADDRESS', keyPairId: 'wallet-1' },
            },
            custody: { kind: 'local', seed: 'quantum' },
        }
        const rekeyedAccounts = [
            {
                id: 'rekeyed-1',
                chains: { algorand: { address: 'REKEYED_1' } },
                custody: { kind: 'local', seed: null },
            },
        ]
        mockRouteParams.current = {
            account: quantumAccount,
            createIfEmpty: undefined,
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
            })
            expect(mockExitAccountFlow).not.toHaveBeenCalled()
        })
    })

    it('algo25 account with a failed rekey scan: continues to NameAccount instead of reporting an import failure', async () => {
        const algo25Account = {
            id: '1',
            chains: {
                algorand: { address: 'PARENT_ADDRESS', keyPairId: 'wallet-1' },
            },
            custody: { kind: 'local', seed: null },
        }
        mockRouteParams.current = {
            account: algo25Account,
            createIfEmpty: undefined,
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockRejectedValue(
            new Error('indexer 500'),
        )

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: algo25Account,
            })
        })
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'onboarding.import_account.failed_title',
            }),
        )
        expect(mockGoBack).not.toHaveBeenCalled()
    })

    it('HD account with a failed rekey scan: exits the flow without claiming no new addresses were found', async () => {
        mockRouteParams.current = {
            account: {
                id: '1',
                chains: {
                    algorand: {
                        address: 'MOCK_ADDRESS',
                        keyPairId: 'wallet-1',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
            createIfEmpty: false,
            notifyOnEmpty: true,
        } as SearchAccountsParams
        const singleAccount = {
            id: '1',
            chains: { algorand: { address: 'MOCK_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockDiscoverAccounts.mockResolvedValue([singleAccount])
        mockDiscoverDelegatedAccounts.mockRejectedValue(
            new Error('indexer 500'),
        )

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockExitAccountFlow).toHaveBeenCalled()
        })
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'onboarding.searching_accounts.no_new_addresses_title',
            }),
        )
        expect(mockGoBack).not.toHaveBeenCalled()
    })
})
