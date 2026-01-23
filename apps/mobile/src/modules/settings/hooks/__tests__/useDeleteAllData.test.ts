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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeleteAllData } from '../useDeleteAllData'
import { useKMS } from '@perawallet/wallet-core-kms'
import { DataStoreRegistry } from '@perawallet/wallet-core-shared'
import { useQueryClient } from '@tanstack/react-query'

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    DataStoreRegistry: {
        clearAll: vi.fn().mockResolvedValue(undefined),
    },
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(),
}))

describe('useDeleteAllData', () => {
    const mockDeleteKey = vi.fn()
    const mockRemoveQueries = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useKMS as Mock).mockReturnValue({
            keys: [{ id: 'key-1' }, { id: 'key-2' }],
            deleteKey: mockDeleteKey,
        })
        ;(useQueryClient as Mock).mockReturnValue({
            removeQueries: mockRemoveQueries,
        })
    })

    it('should clear all data stores and delete keys', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)
        expect(mockDeleteKey).toHaveBeenCalledTimes(2)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
        expect(mockDeleteKey).toHaveBeenCalledWith('key-2')
        expect(DataStoreRegistry.clearAll).toHaveBeenCalledTimes(1)
    })

    it('should not delete keys if id is missing', async () => {
        ;(useKMS as Mock).mockReturnValue({
            keys: [{ id: undefined }, { id: 'key-1' }],
            deleteKey: mockDeleteKey,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockDeleteKey).toHaveBeenCalledTimes(1)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
    })
})
