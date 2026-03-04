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
import { renderHook, act } from '@testing-library/react'
import { useSelectedAccountAddress } from '../useSelectedAccountAddress'
import { useAccountsStore } from '../../store'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => {
            const store = new Map<string, string>()
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value)
                },
                removeItem: (key: string) => {
                    store.delete(key)
                },
            }
        },
    }
})

describe('useSelectedAccountAddress', () => {
    beforeEach(() => {
        useAccountsStore.setState({
            accounts: [],
            selectedAccountAddress: null,
        })
    })

    test('returns selected account address and setter', () => {
        useAccountsStore.setState({
            accounts: [{ address: 'A' } as any, { address: 'B' } as any],
            selectedAccountAddress: 'A',
        })

        const { result } = renderHook(() => useSelectedAccountAddress())
        expect(result.current.selectedAccountAddress).toBe('A')

        act(() => {
            result.current.setSelectedAccountAddress('B')
        })
        expect(useAccountsStore.getState().selectedAccountAddress).toBe('B')
    })

    test('returns null when no selected account address', () => {
        const { result } = renderHook(() => useSelectedAccountAddress())
        expect(result.current.selectedAccountAddress).toBeNull()
    })

    test('does not update when address does not exist in accounts', () => {
        useAccountsStore.setState({
            accounts: [{ address: 'A' } as any],
            selectedAccountAddress: 'A',
        })

        const { result } = renderHook(() => useSelectedAccountAddress())

        act(() => {
            result.current.setSelectedAccountAddress('NONEXISTENT')
        })
        expect(useAccountsStore.getState().selectedAccountAddress).toBe('A')
    })
})
