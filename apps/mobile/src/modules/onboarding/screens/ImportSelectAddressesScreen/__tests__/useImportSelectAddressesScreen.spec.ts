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
    mockMarkBackupComplete,
    mockShowToast,
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
    mockMarkBackupComplete: vi.fn(),
    mockShowToast: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        replace: mockReplace,
        goBack: mockGoBack,
        addListener: vi.fn(() => () => {}),
    }),
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
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
        chains: { algorand: { address: 'ADDR-A', keyPairId: 'w-1' } },
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 0 },
        },
    },
    {
        id: '2',
        chains: { algorand: { address: 'ADDR-B', keyPairId: 'w-1' } },
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 2, keyIndex: 0 },
        },
    },
]

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

    test('Continue commits the import with selected accounts and marks backup', async () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockCommitImport).toHaveBeenCalledWith({
            walletKeyId: 'w-1',
            selectedAccounts: [sampleDiscovered[0]],
        })
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(sampleDiscovered[0])
        expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
    })

    test('single imported account navigates to NameAccount for naming', async () => {
        // Default selection is the first discovered account only.
        const { result } = renderHook(() => useImportSelectAddressesScreen())

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

        // Select the second address too so two accounts are committed.
        act(() => {
            result.current.toggleSelection('ADDR-B')
        })

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

        // Default: first account is preselected, so canContinue should be true.
        expect(result.current.canContinue).toBe(true)

        // Toggle off the preselected one to simulate empty selection.
        act(() => {
            result.current.toggleSelection('ADDR-A')
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
            sampleDiscovered[0],
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

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                title: 'onboarding.import_account.failed_title',
            }),
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

        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'onboarding.import_account.failed_title',
            }),
        )
        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(mockExitFailedAccountFlow).not.toHaveBeenCalled()
    })
})
