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

describe('mnemonicBackupStore', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('initial state has empty backedUpKeyIds', async () => {
        const { useMnemonicBackupStore } = await import('../store')
        const { result } = renderHook(() => useMnemonicBackupStore())

        expect(result.current.backedUpKeyIds).toEqual({})
    })

    test('markBackedUp adds a key id to the record', async () => {
        const { useMnemonicBackupStore } = await import('../store')
        const { result } = renderHook(() => useMnemonicBackupStore())

        act(() => {
            result.current.markBackedUp('entropy-1')
        })

        expect(result.current.backedUpKeyIds).toEqual({ 'entropy-1': true })
    })

    test('isBackedUp returns false for unknown id', async () => {
        const { useMnemonicBackupStore } = await import('../store')
        const { result } = renderHook(() => useMnemonicBackupStore())

        expect(result.current.isBackedUp('unknown')).toBe(false)
    })

    test('isBackedUp returns true after markBackedUp', async () => {
        const { useMnemonicBackupStore } = await import('../store')
        const { result } = renderHook(() => useMnemonicBackupStore())

        act(() => {
            result.current.markBackedUp('entropy-2')
        })

        expect(result.current.isBackedUp('entropy-2')).toBe(true)
    })

    test('isBackedUp returns false for null or undefined input', async () => {
        const { useMnemonicBackupStore } = await import('../store')
        const { result } = renderHook(() => useMnemonicBackupStore())

        expect(result.current.isBackedUp(null)).toBe(false)
        expect(result.current.isBackedUp(undefined)).toBe(false)
    })

    test('resetState clears all backed-up ids', async () => {
        const { useMnemonicBackupStore } = await import('../store')
        const { result } = renderHook(() => useMnemonicBackupStore())

        act(() => {
            result.current.markBackedUp('entropy-3')
            result.current.resetState()
        })

        expect(result.current.backedUpKeyIds).toEqual({})
    })
})
