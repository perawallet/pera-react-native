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

import { act, renderHook, waitFor } from '@test-utils/render'
import { vi } from 'vitest'
import { useSearchAccountsScreen } from '../useSearchAccountsScreen'
import type { SearchAccountsParams } from '../../../routes/types'

const {
    mockShowToast,
    mockErrorToast,
    mockGoBack,
    mockReplace,
    mockRescanHdWallet,
    mockDiscoverDelegatedAccounts,
    mockDiscoverImportAccounts,
    mockCancelImport,
    mockExitAccountFlow,
    mockSetShouldPlayConfetti,
    mockSetSelectedAccountId,
    mockBeforeRemoveListeners,
    mockRouteParams,
} = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockErrorToast: vi.fn(),
    mockGoBack: vi.fn(),
    mockReplace: vi.fn(),
    mockRescanHdWallet: vi.fn(),
    mockDiscoverDelegatedAccounts: vi.fn(),
    mockDiscoverImportAccounts: vi.fn(),
    mockCancelImport: vi.fn(),
    mockExitAccountFlow: vi.fn(),
    mockSetShouldPlayConfetti: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockBeforeRemoveListeners: { current: [] as (() => void)[] },
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
        } as SearchAccountsParams,
    },
}))

vi.mock('@hooks/useLanguage')
vi.mock('@modules/chain-ui', () => ({
    networkListOf: (chainIds: string[]) => chainIds.join(' & '),
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
        errorToast: mockErrorToast,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountDiscovery: () => ({
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
}))

vi.mock('../useHdWalletRescan', () => ({
    useHdWalletRescan: () => ({ rescanHdWallet: mockRescanHdWallet }),
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
    useNavigation: () => ({
        addListener: (_event: string, listener: () => void) => {
            mockBeforeRemoveListeners.current.push(listener)
            return () => undefined
        },
    }),
    useRoute: () => ({
        params: mockRouteParams.current,
    }),
}))

describe('useSearchAccountsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockBeforeRemoveListeners.current = []
        // Default success mocks
        mockDiscoverDelegatedAccounts.mockResolvedValue([])
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
        } as SearchAccountsParams
    })

    it('hands an HD account to the wallet rescan and does nothing else', async () => {
        const account = (mockRouteParams.current as { account: unknown })
            .account

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockRescanHdWallet).toHaveBeenCalledExactlyOnceWith(
                account,
                expect.objectContaining({ chainIds: undefined }),
            )
        })
        expect(mockDiscoverDelegatedAccounts).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it("passes a retry's chains on to the wallet rescan", async () => {
        mockRouteParams.current = {
            ...(mockRouteParams.current as object),
            chainIds: ['base', 'bsc'],
        } as SearchAccountsParams
        const account = (mockRouteParams.current as { account: unknown })
            .account

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockRescanHdWallet).toHaveBeenCalledExactlyOnceWith(
                account,
                expect.objectContaining({ chainIds: ['base', 'bsc'] }),
            )
        })
    })

    const rescanOptions = () =>
        mockRescanHdWallet.mock.calls[0]![1] as {
            signal: AbortSignal
            onProgress: (progress: unknown) => void
            hasLeft: () => boolean
        }

    it('shows each network and the account being checked once a rescan reports', async () => {
        const { result } = renderHook(() => useSearchAccountsScreen())
        await waitFor(() => expect(mockRescanHdWallet).toHaveBeenCalled())
        expect(result.current.canCancel).toBe(false)

        act(() =>
            rescanOptions().onProgress({
                chainIds: ['algorand', 'base', 'bsc'],
                failedChainIds: ['base'],
                refusedChainIds: ['bsc'],
                checkedAccountCount: 3,
                foundCount: 1,
            }),
        )

        expect(result.current.canCancel).toBe(true)
        expect(result.current.networks).toEqual([
            expect.objectContaining({
                chainId: 'algorand',
                status: 'checking',
            }),
            expect.objectContaining({ chainId: 'base', status: 'failed' }),
            expect.objectContaining({ chainId: 'bsc', status: 'unavailable' }),
        ])
        expect(result.current.progressLabel).toBe(
            'onboarding.searching_accounts.checked_accounts · onboarding.searching_accounts.new_found',
        )
    })

    it('Cancel aborts the rescan and shows it stopping', async () => {
        const { result } = renderHook(() => useSearchAccountsScreen())
        await waitFor(() => expect(mockRescanHdWallet).toHaveBeenCalled())

        act(() => result.current.handleCancel())

        expect(rescanOptions().signal.aborted).toBe(true)
        expect(result.current.isCancelling).toBe(true)
        expect(rescanOptions().hasLeft()).toBe(false)
    })

    it('leaving mid-rescan aborts it and marks the screen as left', async () => {
        renderHook(() => useSearchAccountsScreen())
        await waitFor(() => expect(mockRescanHdWallet).toHaveBeenCalled())

        mockBeforeRemoveListeners.current.at(-1)!()

        expect(rescanOptions().signal.aborted).toBe(true)
        expect(rescanOptions().hasLeft()).toBe(true)
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
        mockDiscoverImportAccounts.mockResolvedValue({
            accounts: discovered,
            failedChainIds: ['base'],
        })

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportSelectAddresses', {
                mode: 'import',
                walletKeyId: 'w-1',
                accounts: discovered,
                failedChainIds: ['base'],
            })
            expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
            expect(mockCancelImport).not.toHaveBeenCalled()
        })
    })

    it('in import mode, tells the selection when its one account is only the fallback for no activity', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        const origin = { id: '0', chains: {}, custody: { kind: 'local' } }
        mockDiscoverImportAccounts.mockResolvedValue({
            accounts: [origin],
            failedChainIds: ['ethereum'],
            isOriginFallback: true,
        })

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() =>
            expect(mockReplace).toHaveBeenCalledWith(
                'ImportSelectAddresses',
                expect.objectContaining({ isOriginFallback: true }),
            ),
        )
    })

    it('in import mode, hands a retry the earlier search so the new one adds to it', async () => {
        const previous = { accounts: [], failedChainIds: ['ethereum'] }
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            previous,
        } as unknown as SearchAccountsParams
        mockDiscoverImportAccounts.mockResolvedValue({
            accounts: [{ id: '1', chains: {}, custody: { kind: 'local' } }],
            failedChainIds: [],
        })

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() =>
            expect(mockDiscoverImportAccounts).toHaveBeenCalledWith(
                expect.objectContaining({ walletKeyId: 'w-1', previous }),
            ),
        )
    })

    it('in import mode, shows each network as the walk reports, with no Cancel button', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        mockDiscoverImportAccounts.mockReturnValue(new Promise(() => undefined))

        const { result } = renderHook(() => useSearchAccountsScreen())
        await waitFor(() =>
            expect(mockDiscoverImportAccounts).toHaveBeenCalled(),
        )
        const { onProgress } = mockDiscoverImportAccounts.mock.calls[0]![0] as {
            onProgress: (progress: unknown) => void
        }

        act(() =>
            onProgress({
                chainIds: ['algorand', 'base'],
                failedChainIds: ['base'],
                refusedChainIds: [],
                checkedAccountCount: 5,
                foundCount: 2,
            }),
        )

        expect(result.current.networks).toEqual([
            expect.objectContaining({
                chainId: 'algorand',
                status: 'checking',
            }),
            expect.objectContaining({ chainId: 'base', status: 'failed' }),
        ])
        expect(result.current.progressLabel).toBe(
            'onboarding.searching_accounts.checked_accounts · onboarding.searching_accounts.new_found',
        )
        expect(result.current.canCancel).toBe(false)
    })

    it('in import mode, leaving mid-search aborts the walk through the signal it was given', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        mockDiscoverImportAccounts.mockReturnValue(new Promise(() => undefined))

        renderHook(() => useSearchAccountsScreen())
        await waitFor(() => {
            expect(mockBeforeRemoveListeners.current.length).toBeGreaterThan(0)
            expect(mockDiscoverImportAccounts).toHaveBeenCalled()
        })
        const { signal } = mockDiscoverImportAccounts.mock.calls[0]![0] as {
            signal: AbortSignal
        }
        expect(signal.aborted).toBe(false)

        mockBeforeRemoveListeners.current.at(-1)!()

        expect(signal.aborted).toBe(true)
    })

    it('in import mode, on empty discovery cancels the import session and goes back', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        mockDiscoverImportAccounts.mockResolvedValue({
            accounts: [],
            failedChainIds: [],
        })

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockCancelImport).toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'onboarding.import_account.failed_title',
                'onboarding.import_account.failed_body',
            )
            expect(mockGoBack).toHaveBeenCalled()
            expect(mockReplace).not.toHaveBeenCalled()
        })
    })

    it('in import mode, on empty discovery names the networks that could not be checked', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        mockDiscoverImportAccounts.mockResolvedValue({
            accounts: [],
            failedChainIds: ['algorand', 'ethereum'],
        })

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockErrorToast).toHaveBeenCalledWith(
                'onboarding.import_account.failed_title',
                'onboarding.import_account.failed_networks_body',
            )
            expect(mockCancelImport).toHaveBeenCalled()
            expect(mockGoBack).toHaveBeenCalled()
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
            expect(mockErrorToast).toHaveBeenCalledWith(
                'onboarding.import_account.failed_title',
                'onboarding.import_account.failed_body',
            )
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    it('in import mode, leaving mid-search cancels the session and ignores the late result', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
        } as SearchAccountsParams
        let finishDiscovery: (walked: unknown) => void = () => undefined
        mockDiscoverImportAccounts.mockReturnValue(
            new Promise(resolve => {
                finishDiscovery = resolve
            }),
        )

        renderHook(() => useSearchAccountsScreen())
        await waitFor(() => {
            expect(mockBeforeRemoveListeners.current.length).toBeGreaterThan(0)
            expect(mockDiscoverImportAccounts).toHaveBeenCalled()
        })
        mockBeforeRemoveListeners.current.at(-1)!()
        finishDiscovery({ accounts: [{ id: '1' }], failedChainIds: [] })
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockCancelImport).toHaveBeenCalledOnce()
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
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
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
                hasImportedAccounts: true,
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
        } as SearchAccountsParams
        mockDiscoverDelegatedAccounts.mockResolvedValue(rekeyedAccounts)

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
            expect(mockReplace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
                accounts: rekeyedAccounts,
                hasImportedAccounts: true,
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
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()
    })
})
