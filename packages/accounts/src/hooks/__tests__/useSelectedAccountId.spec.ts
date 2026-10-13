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
import { renderHook, act } from '@testing-library/react'
import { useSelectedAccountId } from '../useSelectedAccountId'
import { useAccountsStore } from '../../store'
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

describe('useSelectedAccountId', () => {
    beforeEach(() => {
        useAccountsStore.setState({
            accounts: [],
            selectedAccountId: null,
        })
    })

    test('returns the selected account id and setter', () => {
        useAccountsStore.setState({
            accounts: [
                testAccount('watch', 'A', { id: 'a' }),
                testAccount('watch', 'B', { id: 'b' }),
            ],
            selectedAccountId: 'a',
        })

        const { result } = renderHook(() => useSelectedAccountId())
        expect(result.current.selectedAccountId).toBe('a')

        act(() => {
            result.current.setSelectedAccountId('b')
        })
        expect(useAccountsStore.getState().selectedAccountId).toBe('b')
    })

    test('returns null when no account is selected', () => {
        const { result } = renderHook(() => useSelectedAccountId())
        expect(result.current.selectedAccountId).toBeNull()
    })

    test('does not update when the id is not an account', () => {
        useAccountsStore.setState({
            accounts: [testAccount('watch', 'A', { id: 'a' })],
            selectedAccountId: 'a',
        })

        const { result } = renderHook(() => useSelectedAccountId())

        act(() => {
            result.current.setSelectedAccountId('NONEXISTENT')
        })
        expect(useAccountsStore.getState().selectedAccountId).toBe('a')
    })
})
