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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

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
        chains: {
            has: () => true,
            get: () => ({
                descriptor: { signing: { standaloneSecret: 'mnemonic' } },
            }),
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

describe('useMarkMnemonicBackupComplete', () => {
    beforeEach(() => {
        vi.resetModules()
        mockUseAccountsStore.mockReset()
    })

    test('marks the wallet root id when account is Algo25', async () => {
        const { useMnemonicBackupStore } = await import('../../store')
        const { useMarkMnemonicBackupComplete } =
            await import('../useMarkMnemonicBackupComplete')

        const account: WalletAccount = {
            custody: { kind: 'local', seed: null },
            address: 'ADDR',
            keyPairId: 'kp-1',
        }

        mockUseAccountsStore.mockReturnValue([account])

        const { result } = renderHook(() => useMarkMnemonicBackupComplete())
        act(() => {
            result.current(account)
        })

        expect(useMnemonicBackupStore.getState().backedUpKeyIds).toEqual({
            'kp-1': true,
        })
    })

    test('marks all HD siblings sharing the same wallet root', async () => {
        const { useMnemonicBackupStore } = await import('../../store')
        const { useMarkMnemonicBackupComplete } =
            await import('../useMarkMnemonicBackupComplete')

        const hdDetails = {
            account: 0,
            change: 0,
            keyIndex: 0,
            derivationType: 9 as const,
        }
        const a1: WalletAccount = {
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'HD1',
            keyPairId: 'kp-shared',
            hdWalletDetails: hdDetails,
        }
        const a2: WalletAccount = {
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 1 },
            },
            address: 'HD2',
            keyPairId: 'kp-shared',
            hdWalletDetails: { ...hdDetails, keyIndex: 1 },
        }
        const a3: WalletAccount = {
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'HD3',
            keyPairId: 'kp-other',
            hdWalletDetails: hdDetails,
        }

        mockUseAccountsStore.mockReturnValue([a1, a2, a3])

        const { result } = renderHook(() => useMarkMnemonicBackupComplete())
        act(() => {
            result.current(a1)
        })

        expect(useMnemonicBackupStore.getState().backedUpKeyIds).toEqual({
            'kp-shared': true,
        })
    })

    test('is a no-op for accounts without backup concept', async () => {
        const { useMnemonicBackupStore } = await import('../../store')
        const { useMarkMnemonicBackupComplete } =
            await import('../useMarkMnemonicBackupComplete')

        const account: WalletAccount = {
            custody: { kind: 'watch' },
            address: 'WATCH',
        }

        mockUseAccountsStore.mockReturnValue([account])

        const { result } = renderHook(() => useMarkMnemonicBackupComplete())
        act(() => {
            result.current(account)
        })

        expect(useMnemonicBackupStore.getState().backedUpKeyIds).toEqual({})
    })
})
