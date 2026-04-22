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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockUseAccountsStore = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
        },
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            mockUseAccountsStore(selector),
    }
})

describe('useMarkBackupComplete', () => {
    beforeEach(() => {
        vi.resetModules()
        mockUseAccountsStore.mockReset()
    })

    test('marks the single key id when account is Algo25', async () => {
        const { useBackupStore } = await import('../../store')
        const { useMarkBackupComplete } =
            await import('../useMarkBackupComplete')

        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR',
            keyPairId: 'kp-1',
            seedKeyId: 'seed-1',
        }

        mockUseAccountsStore.mockReturnValue([account])

        const { result } = renderHook(() => useMarkBackupComplete())
        act(() => {
            result.current(account)
        })

        expect(useBackupStore.getState().backedUpKeyIds).toEqual({
            'seed-1': true,
        })
    })

    test('marks all HD siblings sharing the same entropyKeyId', async () => {
        const { useBackupStore } = await import('../../store')
        const { useMarkBackupComplete } =
            await import('../useMarkBackupComplete')

        const hdDetails = {
            account: 0,
            change: 0,
            keyIndex: 0,
            derivationType: 9 as const,
        }
        const a1: WalletAccount = {
            type: AccountTypes.hdWallet,
            address: 'HD1',
            keyPairId: 'kp-1',
            entropyKeyId: 'entropy-A',
            hdWalletDetails: hdDetails,
        }
        const a2: WalletAccount = {
            type: AccountTypes.hdWallet,
            address: 'HD2',
            keyPairId: 'kp-2',
            entropyKeyId: 'entropy-A',
            hdWalletDetails: { ...hdDetails, keyIndex: 1 },
        }
        const a3: WalletAccount = {
            type: AccountTypes.hdWallet,
            address: 'HD3',
            keyPairId: 'kp-3',
            entropyKeyId: 'entropy-B',
            hdWalletDetails: hdDetails,
        }

        mockUseAccountsStore.mockReturnValue([a1, a2, a3])

        const { result } = renderHook(() => useMarkBackupComplete())
        act(() => {
            result.current(a1)
        })

        expect(useBackupStore.getState().backedUpKeyIds).toEqual({
            'entropy-A': true,
        })
    })

    test('is a no-op for accounts without backup concept', async () => {
        const { useBackupStore } = await import('../../store')
        const { useMarkBackupComplete } =
            await import('../useMarkBackupComplete')

        const account: WalletAccount = {
            type: AccountTypes.watch,
            address: 'WATCH',
        }

        mockUseAccountsStore.mockReturnValue([account])

        const { result } = renderHook(() => useMarkBackupComplete())
        act(() => {
            result.current(account)
        })

        expect(useBackupStore.getState().backedUpKeyIds).toEqual({})
    })
})
