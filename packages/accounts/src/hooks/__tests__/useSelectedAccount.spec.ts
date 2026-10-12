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
import { useSelectedAccount } from '../useSelectedAccount'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import { testAccount } from '../../__tests__/accountFactory'

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

describe('useSelectedAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({
            accounts: [],
            selectedAccountId: null,
        })
    })

    test('returns selected account', () => {
        const accounts: WalletAccount[] = [
            testAccount('local', 'A', { id: '1', name: 'A' }),
            testAccount('local', 'B', { id: '2', name: 'B' }),
        ]
        useAccountsStore.setState({ accounts, selectedAccountId: '2' })

        const { result } = renderHook(() => useSelectedAccount())
        expect(result.current).toEqual(accounts[1])
    })

    test('returns null if no selection', () => {
        const { result } = renderHook(() => useSelectedAccount())
        expect(result.current).toBeNull()
    })
})
