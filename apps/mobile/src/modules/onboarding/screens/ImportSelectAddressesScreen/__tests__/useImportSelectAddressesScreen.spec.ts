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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@test-utils/render'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useImportSelectAddressesScreen } from '../useImportSelectAddressesScreen'

const {
    mockReplace,
    mockGoBack,
    mockAllAccounts,
    mockRouteParams,
    mockSetAccounts,
    mockSetSelectedAccountId,
    mockDiscoverDelegatedAccounts,
    mockExitAccountFlow,
    mockExitFailedAccountFlow,
    mockCommitImport,
    mockCancelImport,
    mockSyncCandidateAccounts,
    mockMarkBackupComplete,
    mockShowToast,
    mockErrorToast,
} = vi.hoisted(() => ({
    mockReplace: vi.fn(),
    mockGoBack: vi.fn(),
    mockAllAccounts: { current: [] as WalletAccount[] },
    mockRouteParams: { current: {} as Record<string, unknown> },
    mockSetAccounts: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockDiscoverDelegatedAccounts: vi.fn(),
    mockExitAccountFlow: vi.fn(),
    mockExitFailedAccountFlow: vi.fn(),
    mockCommitImport: vi.fn(),
    mockCancelImport: vi.fn(),
    mockSyncCandidateAccounts: vi.fn(),
    mockMarkBackupComplete: vi.fn(),
    mockShowToast: vi.fn(),
    mockErrorToast: vi.fn(),
}))

vi.mock('@hooks/useLanguage')
vi.mock('@modules/chain-ui', () => ({
    networkListOf: (chainIds: string[]) => chainIds.join(' & '),
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        replace: mockReplace,
        goBack: mockGoBack,
        addListener: vi.fn(() => () => {}),
    }),
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))
vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mockRouteParams.current }),
    useNavigation: () => ({ addListener: vi.fn(() => () => {}) }),
}))
vi.mock('../../../hooks', () => ({
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
        exitFailedAccountFlow: mockExitFailedAccountFlow,
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
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mockAllAccounts.current,
    useSetAccounts: () => ({ setAccounts: mockSetAccounts }),
    useSelectedAccountId: () => ({
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
    useAccountDiscovery: () => ({
        discoverDelegatedAccounts: mockDiscoverDelegatedAccounts,
    }),
    useHDImportSession: () => ({
        commitImport: mockCommitImport,
        cancelImport: mockCancelImport,
    }),
    useSyncCandidateAccounts: mockSyncCandidateAccounts,
    DerivationTypes: { Peikert: 9 },
}))
vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: () => mockMarkBackupComplete,
}))
// Test fixtures stamp `keyPairId` with the seed id directly (legacy
// shape), so map identity → identity here. Production accounts stamp
// keyPairId with the derived child id and the kms hook walks the
// metadata.parentKeyId chain to resolve the seed.
vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        seedIdOf: (childId?: string) => childId,
    }),
}))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    deferToNextCycle: (fn: () => unknown) => fn(),
}))

const sampleDiscovered = [
    {
        id: '1',
        name: 'Account #1',
        chains: { algorand: { address: 'ADDR-A', keyPairId: 'w-1' } },
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 0 },
        },
    },
    {
        id: '2',
        name: 'Account #2',
        chains: { algorand: { address: 'ADDR-B', keyPairId: 'w-1' } },
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 2, keyIndex: 0 },
        },
    },
]

describe('useImportSelectAddressesScreen — naming', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAllAccounts.current = []
    })

    test('offers each unnamed new account the name the store would give it', () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: sampleDiscovered.map(account => ({
                ...account,
                name: '',
            })),
        }

        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.accounts.map(account => account.name)).toEqual([
            'Account #1',
            'Account #2',
        ])
    })
})

describe('useImportSelectAddressesScreen — import mode', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAllAccounts.current = []
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: sampleDiscovered,
        }
        mockCommitImport.mockResolvedValue([sampleDiscovered[0]])
        mockDiscoverDelegatedAccounts.mockResolvedValue([])
    })

    test('names the networks the search could not check', () => {
        mockRouteParams.current = {
            ...mockRouteParams.current,
            failedChainIds: ['ethereum', 'base'],
        }

        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.uncheckedNetworks).toBe('ethereum & base')
    })

    test.each([
        ['it was not given any', undefined],
        ['it was given an empty list', []],
    ])('names no network when %s', (_, failedChainIds) => {
        mockRouteParams.current = {
            ...mockRouteParams.current,
            failedChainIds,
        }

        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.uncheckedNetworks).toBeUndefined()
    })

    test('preselects every new account', () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.selectedAccountIds).toEqual(new Set(['1', '2']))
    })

    test('Continue commits the import with selected accounts and marks each backed up', async () => {
        mockCommitImport.mockResolvedValue(sampleDiscovered)
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockCommitImport).toHaveBeenCalledWith({
            walletKeyId: 'w-1',
            selectedAccounts: sampleDiscovered,
        })
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(sampleDiscovered[0])
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(sampleDiscovered[1])
        expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
    })

    test('marks the account commit stored, not the candidate, as commit can add a key the candidate lacked', async () => {
        const stored = {
            ...sampleDiscovered[0],
            chains: {
                ...sampleDiscovered[0].chains,
                ethereum: { address: '0xA', keyPairId: 'w-1-evm' },
            },
        }
        mockCommitImport.mockResolvedValue([stored])
        const { result } = renderHook(() => useImportSelectAddressesScreen())
        act(() => {
            result.current.toggleSelection('2')
        })

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockMarkBackupComplete).toHaveBeenCalledWith(stored)
        expect(mockMarkBackupComplete).not.toHaveBeenCalledWith(
            sampleDiscovered[0],
        )
    })

    test('marks an account already held from the same seed backed up too', async () => {
        const heldSibling = {
            id: 'held',
            chains: { algorand: { address: 'ADDR-HELD', keyPairId: 'w-1' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        } as WalletAccount
        mockAllAccounts.current = [heldSibling]
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockMarkBackupComplete).toHaveBeenCalledWith(heldSibling)
    })

    test('keeps the just-imported accounts listed as new while the import runs', async () => {
        mockCommitImport.mockImplementation(async () => {
            mockAllAccounts.current = sampleDiscovered as WalletAccount[]
            return sampleDiscovered
        })
        mockDiscoverDelegatedAccounts.mockReturnValue(new Promise(() => {}))
        const { result, rerender } = renderHook(() =>
            useImportSelectAddressesScreen(),
        )

        await act(async () => {
            void result.current.handleContinue()
        })
        rerender()

        expect(result.current.areAllImported).toBe(false)
        expect(result.current.importedAccountIds).toEqual(new Set())
    })

    test('single imported account navigates to NameAccount for naming', async () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())
        act(() => {
            result.current.toggleSelection('2')
        })

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
            account: sampleDiscovered[0],
        })
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    test('multiple imported accounts keep auto-names and exit without NameAccount', async () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalledWith(
            'NameAccount',
            expect.anything(),
        )
    })

    test('Continue without any selection does not commit (button is gated)', async () => {
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: sampleDiscovered,
        }
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.canContinue).toBe(true)

        act(() => {
            result.current.toggleSelection('1')
        })
        act(() => {
            result.current.toggleSelection('2')
        })

        expect(result.current.canContinue).toBe(false)
    })

    test('re-importing a wallet whose addresses are all known still marks backup', async () => {
        // Every discovered address is already in the account store, so
        // there is nothing new to commit — but re-entering the mnemonic
        // proved possession, so the wallet should still be flagged as
        // backed up. Without this, accounts created before the auto-mark
        // feature shipped would be stuck showing the banner forever.
        const existingSibling = { ...sampleDiscovered[0] }
        mockAllAccounts.current = [
            existingSibling as WalletAccount,
            sampleDiscovered[1] as WalletAccount,
        ]
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: sampleDiscovered,
        }

        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.areAllImported).toBe(true)
        expect(result.current.canContinue).toBe(true)

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockCommitImport).not.toHaveBeenCalled()
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(existingSibling)
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(sampleDiscovered[1])
        expect(mockCancelImport).toHaveBeenCalledOnce()
    })

    const linked = {
        id: 'linked',
        chains: {
            algorand: { address: 'ALGO-LINKED', keyPairId: 'w-1' },
            ethereum: { address: '0xLINKED', keyPairId: 'w-1-evm' },
        },
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 3, keyIndex: 0 },
        },
    }

    test('lists a candidate as imported when its HD account landed earlier with only one of its entries', () => {
        mockAllAccounts.current = [
            {
                id: 'held',
                chains: { ethereum: { address: '0xLINKED', keyPairId: 'k' } },
                custody: linked.custody,
            } as unknown as WalletAccount,
        ]
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: [linked],
        }

        const { result } = renderHook(() => useImportSelectAddressesScreen())

        expect(result.current.importedAccountIds).toEqual(new Set(['linked']))
        expect(result.current.areAllImported).toBe(true)
    })

    test('imports the rest of a candidate when a watch account holds one of its addresses', async () => {
        mockAllAccounts.current = [
            {
                id: 'watched',
                chains: { ethereum: { address: '0xLINKED' } },
                custody: { kind: 'watch' },
            } as unknown as WalletAccount,
        ]
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: [linked],
        }

        const { result } = renderHook(() => useImportSelectAddressesScreen())
        expect(result.current.importedAccountIds).toEqual(new Set())
        expect(Object.keys(result.current.accounts[0].chains)).toEqual([
            'algorand',
        ])

        await act(async () => {
            await result.current.handleContinue()
        })

        const [{ selectedAccounts }] = mockCommitImport.mock.calls[0]
        expect(selectedAccounts).toHaveLength(1)
        expect(Object.keys(selectedAccounts[0].chains)).toEqual(['algorand'])
    })

    test('reports linked addresses only when an account holds more than one distinct address', () => {
        const { result: single } = renderHook(() =>
            useImportSelectAddressesScreen(),
        )
        expect(single.current.hasLinkedAddresses).toBe(false)

        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: [
                {
                    ...sampleDiscovered[0],
                    chains: {
                        algorand: { address: 'ADDR-A', keyPairId: 'w-1' },
                        ethereum: { address: '0xA', keyPairId: 'w-1-evm' },
                    },
                },
            ],
        }
        const { result: linked } = renderHook(() =>
            useImportSelectAddressesScreen(),
        )
        expect(linked.current.hasLinkedAddresses).toBe(true)
    })

    test('syncs the candidates for the preview', () => {
        renderHook(() => useImportSelectAddressesScreen())

        expect(mockSyncCandidateAccounts).toHaveBeenCalledWith(sampleDiscovered)
    })

    test('scans no empty address for an account with no entry on the scan chain', async () => {
        const evmOnly = {
            id: 'evm-only',
            chains: { ethereum: { address: '0xONLY', keyPairId: 'w-1-evm' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 4, keyIndex: 0 },
            },
        }
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: [evmOnly],
        }
        mockCommitImport.mockResolvedValue([evmOnly])
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockDiscoverDelegatedAccounts).toHaveBeenCalledWith({
            accountAddresses: [],
        })
    })

    test('offers to check the unchecked networks again only for an import that left some', () => {
        mockRouteParams.current = {
            ...mockRouteParams.current,
            failedChainIds: ['ethereum'],
        }
        const { result: withUnchecked } = renderHook(() =>
            useImportSelectAddressesScreen(),
        )
        expect(withUnchecked.current.canRetryNetworks).toBe(true)

        mockRouteParams.current = {
            ...mockRouteParams.current,
            failedChainIds: [],
        }
        const { result: allChecked } = renderHook(() =>
            useImportSelectAddressesScreen(),
        )
        expect(allChecked.current.canRetryNetworks).toBe(false)
    })

    test('checking again hands the import session to a new search, without cancelling it on the way out', async () => {
        let beforeRemoveCallback: Optional<() => void>
        const reactNavigationMock = await import('@react-navigation/native')
        ;(
            reactNavigationMock as unknown as { useNavigation: () => unknown }
        ).useNavigation = () => ({
            addListener: (eventName: string, cb: () => void) => {
                if (eventName === 'beforeRemove') beforeRemoveCallback = cb
                return () => {}
            },
        })
        mockRouteParams.current = {
            ...mockRouteParams.current,
            failedChainIds: ['ethereum'],
            isOriginFallback: true,
        }
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        act(() => result.current.handleRetryNetworks())
        act(() => beforeRemoveCallback?.())

        expect(mockReplace).toHaveBeenCalledWith('SearchAccounts', {
            mode: 'import',
            walletKeyId: 'w-1',
            previous: {
                accounts: sampleDiscovered,
                failedChainIds: ['ethereum'],
                isOriginFallback: true,
            },
        })
        expect(mockCancelImport).not.toHaveBeenCalled()
    })

    test('cancelImport runs when navigation beforeRemove fires (back/swipe)', async () => {
        let beforeRemoveCallback: Optional<() => void>
        const addListenerSpy = vi.fn((eventName: string, cb: () => void) => {
            if (eventName === 'beforeRemove') {
                beforeRemoveCallback = cb
            }
            return () => {}
        })

        const reactNavigationMock = await import('@react-navigation/native')
        ;(
            reactNavigationMock as unknown as { useNavigation: () => unknown }
        ).useNavigation = () => ({ addListener: addListenerSpy })

        renderHook(() => useImportSelectAddressesScreen())

        expect(addListenerSpy).toHaveBeenCalledWith(
            'beforeRemove',
            expect.any(Function),
        )

        act(() => beforeRemoveCallback?.())

        expect(mockCancelImport).toHaveBeenCalled()
    })
})

describe('useImportSelectAddressesScreen — legacy (non-import) mode', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAllAccounts.current = []
        mockRouteParams.current = { accounts: sampleDiscovered }
        mockDiscoverDelegatedAccounts.mockResolvedValue([])
        useAccountsStore.getState().setAccounts([])
    })

    test('reads the store fresh inside the deferred write so a concurrent add is not dropped', async () => {
        const concurrent = {
            id: 'c',
            name: 'Concurrent',
            chains: { algorand: { address: 'CONCURRENT', keyPairId: 'kp-c' } },
            custody: { kind: 'local', seed: null },
        } as WalletAccount
        // Lands after render (useAllAccounts snapshot) but before the
        // deferred commit — e.g. background sync or another import flow.
        useAccountsStore.getState().setAccounts([concurrent])

        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockSetAccounts).toHaveBeenCalledWith([
            concurrent,
            ...sampleDiscovered,
        ])
    })
})

describe('useImportSelectAddressesScreen - failure reporting', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAllAccounts.current = []
        mockRouteParams.current = {
            mode: 'import',
            walletKeyId: 'w-1',
            accounts: sampleDiscovered,
        }
        mockCommitImport.mockResolvedValue([sampleDiscovered[0]])
        mockDiscoverDelegatedAccounts.mockResolvedValue([])
    })

    test('names the account instead of exiting when only the rekey scan fails', async () => {
        mockDiscoverDelegatedAccounts.mockRejectedValue(
            new Error('indexer 500'),
        )
        const { result } = renderHook(() => useImportSelectAddressesScreen())
        act(() => {
            result.current.toggleSelection('2')
        })

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockReplace).toHaveBeenCalledWith(
            'NameAccount',
            expect.anything(),
        )
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    test('tells the user when the import itself fails, instead of exiting silently', async () => {
        mockCommitImport.mockRejectedValue(new Error('keystore derive failed'))
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'onboarding.import_account.failed_title',
            'onboarding.import_account.failed_body',
        )
        expect(mockExitFailedAccountFlow).toHaveBeenCalled()
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    test('does not report a failed import when a post-commit step throws', async () => {
        mockMarkBackupComplete.mockImplementation(() => {
            throw new Error('backup store write failed')
        })
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(mockExitFailedAccountFlow).not.toHaveBeenCalled()
    })
})
