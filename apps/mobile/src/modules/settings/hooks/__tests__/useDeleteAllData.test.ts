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
import { useDeleteDeviceMutation } from '@perawallet/wallet-core-platform-integration'

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

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useDeleteDeviceMutation: vi.fn(),
}))

describe('useDeleteAllData', () => {
    const mockDeleteKey = vi.fn()
    const mockRemoveQueries = vi.fn()
    const mockDeleteDevices = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useKMS as Mock).mockReturnValue({
            keys: new Map([
                ['key-1', { id: 'key-1' }],
                ['key-2', { id: 'key-2' }],
            ]),
            deleteKey: mockDeleteKey,
        })
        ;(useQueryClient as Mock).mockReturnValue({
            removeQueries: mockRemoveQueries,
        })
        ;(useDeleteDeviceMutation as Mock).mockReturnValue({
            mutateAsync: mockDeleteDevices.mockResolvedValue([]),
        })
    })

    it('should clear all data stores, delete keys, and delete devices', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)
        expect(mockDeleteKey).toHaveBeenCalledTimes(2)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
        expect(mockDeleteKey).toHaveBeenCalledWith('key-2')
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(DataStoreRegistry.clearAll).toHaveBeenCalledTimes(1)
    })

    it('should not delete keys if id is missing', async () => {
        ;(useKMS as Mock).mockReturnValue({
            keys: new Map([
                ['undefined-key', { id: undefined }],
                ['key-1', { id: 'key-1' }],
            ]),
            deleteKey: mockDeleteKey,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockDeleteKey).toHaveBeenCalledTimes(1)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
    })

    it('should continue if deleteDevices fails', async () => {
        mockDeleteDevices.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(DataStoreRegistry.clearAll).toHaveBeenCalledTimes(1)
    })

    it('should continue if deleteKey fails', async () => {
        mockDeleteKey.mockRejectedValue(new Error('Key deletion error'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockDeleteKey).toHaveBeenCalled()
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(DataStoreRegistry.clearAll).toHaveBeenCalledTimes(1)
    })

    it('should handle missing queryClient gracefully', async () => {
        ;(useQueryClient as Mock).mockReturnValue(null)

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockRemoveQueries).not.toHaveBeenCalled()
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(DataStoreRegistry.clearAll).toHaveBeenCalledTimes(1)
    })

    it('should handle missing keys gracefully', async () => {
        ;(useKMS as Mock).mockReturnValue({
            keys: null,
            deleteKey: mockDeleteKey,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current()
        })

        expect(mockDeleteKey).not.toHaveBeenCalled()
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(DataStoreRegistry.clearAll).toHaveBeenCalledTimes(1)
    })
})
