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
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@test-utils/render'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useImportSelectAddressesScreen } from '../useImportSelectAddressesScreen'

const {
    mockReplace,
    mockGoBack,
    mockAllAccounts,
    mockRouteParams,
    mockSetAccounts,
    mockSetSelectedAccountAddress,
    mockDiscoverRekeyedAccounts,
    mockExitAccountFlow,
    mockCommitImport,
    mockCancelImport,
    mockMarkBackupComplete,
} = vi.hoisted(() => ({
    mockReplace: vi.fn(),
    mockGoBack: vi.fn(),
    mockAllAccounts: { current: [] as WalletAccount[] },
    mockRouteParams: { current: {} as Record<string, unknown> },
    mockSetAccounts: vi.fn(),
    mockSetSelectedAccountAddress: vi.fn(),
    mockDiscoverRekeyedAccounts: vi.fn(),
    mockExitAccountFlow: vi.fn(),
    mockCommitImport: vi.fn(),
    mockCancelImport: vi.fn(),
    mockMarkBackupComplete: vi.fn(),
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
vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mockRouteParams.current }),
}))
vi.mock('../../../hooks', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: mockExitAccountFlow }),
}))
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mockAllAccounts.current,
    useSetAccounts: () => ({ setAccounts: mockSetAccounts }),
    useSelectedAccountAddress: () => ({
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    useAccountDiscovery: () => ({
        discoverRekeyedAccounts: mockDiscoverRekeyedAccounts,
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
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    deferToNextCycle: (fn: () => unknown) => fn(),
}))

const sampleDiscovered = [
    {
        id: '1',
        address: 'ADDR-A',
        type: AccountTypes.hdWallet,
        keyPairId: 'w-1',
        hdWalletDetails: {
            account: 1,
            change: 0,
            keyIndex: 0,
            derivationType: 9,
        },
    },
    {
        id: '2',
        address: 'ADDR-B',
        type: AccountTypes.hdWallet,
        keyPairId: 'w-1',
        hdWalletDetails: {
            account: 2,
            change: 0,
            keyIndex: 0,
            derivationType: 9,
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
        mockDiscoverRekeyedAccounts.mockResolvedValue([])
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
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith('ADDR-A')
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

    test('cancelImport runs when handleBack is invoked', async () => {
        const { result } = renderHook(() => useImportSelectAddressesScreen())

        act(() => {
            result.current.handleBack()
        })

        expect(mockCancelImport).toHaveBeenCalled()
        expect(mockGoBack).toHaveBeenCalled()
    })
})
