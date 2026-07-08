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

describe('useRequiresMnemonicBackup', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('returns false when wallet root is already backed up', async () => {
        const { useMnemonicBackupStore } = await import('../../store')
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')

        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR',
            keyPairId: 'kp-backed',
        }

        act(() => {
            useMnemonicBackupStore.getState().markBackedUp('kp-backed')
        })

        const { result } = renderHook(() => useRequiresMnemonicBackup(account))
        expect(result.current).toBe(false)
    })

    test('returns true when wallet root is not in the store', async () => {
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')

        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR',
            keyPairId: 'kp-unbacked',
        }

        const { result } = renderHook(() => useRequiresMnemonicBackup(account))
        expect(result.current).toBe(true)
    })

    test('returns true when a quantum account root is not backed up', async () => {
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')

        const account: WalletAccount = {
            id: 'acc-quantum',
            type: AccountTypes.quantum,
            address: 'ADDR',
            keyPairId: 'kp-quantum-unbacked',
        }

        const { result } = renderHook(() => useRequiresMnemonicBackup(account))
        expect(result.current).toBe(true)
    })

    test('returns false for accounts without a backup concept (watch)', async () => {
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')

        const account: WalletAccount = {
            type: AccountTypes.watch,
            address: 'ADDR',
        }

        const { result } = renderHook(() => useRequiresMnemonicBackup(account))
        expect(result.current).toBe(false)
    })

    test('returns false when account is null/undefined', async () => {
        const { useRequiresMnemonicBackup } =
            await import('../useRequiresMnemonicBackup')

        const { result } = renderHook(() => useRequiresMnemonicBackup(null))
        expect(result.current).toBe(false)
    })
})
