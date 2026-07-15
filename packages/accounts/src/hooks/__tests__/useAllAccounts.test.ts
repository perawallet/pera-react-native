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
import { renderHook } from '@testing-library/react'
import { useAllAccounts } from '../useAllAccounts'
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

describe('useAllAccounts', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('returns all accounts from store', () => {
        const { result } = renderHook(() => useAllAccounts())
        expect(result.current).toEqual([])

        const accounts: WalletAccount[] = [
            {
                id: '1',
                address: 'A',
                type: 'algo25',
                canSign: true,
                name: 'A',
            },
            {
                id: '2',
                address: 'B',
                type: 'algo25',
                canSign: true,
                name: 'B',
            },
        ]
        useAccountsStore.setState({ accounts })

        const { result: result2 } = renderHook(() => useAllAccounts())
        expect(result2.current).toEqual(accounts)
    })

    test('returns all accounts from store when store is empty', () => {
        const { result } = renderHook(() => useAllAccounts())
        expect(result.current).toEqual([])
    })
})
