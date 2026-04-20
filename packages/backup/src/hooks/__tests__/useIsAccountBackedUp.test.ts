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

describe('useIsAccountBackedUp', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('returns true when key id is in the store', async () => {
        const { useBackupStore } = await import('../../store')
        const { useIsAccountBackedUp } = await import('../useIsAccountBackedUp')

        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR',
            keyPairId: 'kp',
            seedKeyId: 'seed-1',
        }

        act(() => {
            useBackupStore.getState().markBackedUp('seed-1')
        })

        const { result } = renderHook(() => useIsAccountBackedUp(account))
        expect(result.current).toBe(true)
    })

    test('returns false when key id is not in the store', async () => {
        const { useIsAccountBackedUp } = await import('../useIsAccountBackedUp')

        const account: WalletAccount = {
            type: AccountTypes.algo25,
            address: 'ADDR',
            keyPairId: 'kp',
            seedKeyId: 'seed-unbacked',
        }

        const { result } = renderHook(() => useIsAccountBackedUp(account))
        expect(result.current).toBe(false)
    })

    test('returns true (no backup concept) for watch accounts', async () => {
        const { useIsAccountBackedUp } = await import('../useIsAccountBackedUp')

        const account: WalletAccount = {
            type: AccountTypes.watch,
            address: 'ADDR',
        }

        const { result } = renderHook(() => useIsAccountBackedUp(account))
        expect(result.current).toBe(true)
    })

    test('returns true when account is null/undefined', async () => {
        const { useIsAccountBackedUp } = await import('../useIsAccountBackedUp')

        const { result } = renderHook(() => useIsAccountBackedUp(null))
        expect(result.current).toBe(true)
    })
})
