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
import { useSetAccounts } from '../useSetAccounts'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: { getDevicePlatform: () => 'ios' },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

describe('useSetAccounts', () => {
    beforeEach(() => {
        useAccountsStore.setState({
            accounts: [],
            selectedAccountAddress: null,
            manualAccountOrder: [],
        })
    })

    test('exposes setAccounts from the store', () => {
        const { result } = renderHook(() => useSetAccounts())

        expect(typeof result.current.setAccounts).toBe('function')
    })

    test('writes accounts to the store when called', () => {
        const accounts: WalletAccount[] = [
            {
                id: '1',
                address: 'A',
                type: 'algo25',
                canSign: true,
                name: 'A',
            },
        ]

        const { result } = renderHook(() => useSetAccounts())

        act(() => {
            result.current.setAccounts(accounts)
        })

        expect(useAccountsStore.getState().accounts).toEqual(accounts)
    })
})
