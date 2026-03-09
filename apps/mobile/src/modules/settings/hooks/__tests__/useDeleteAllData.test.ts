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
import { useDeleteAllData, clearAccountsStore } from '../useDeleteAllData'
import { useKMS } from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useQueryClient } from '@tanstack/react-query'
import { useDeleteDeviceMutation } from '@perawallet/wallet-core-device'
import { clearAllStores } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    clearDataStores: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { api: vi.fn(), error: vi.fn(), info: vi.fn() },
    clearAllStores: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeleteDeviceMutation: vi.fn(),
}))

const { mockAccountsResetState, mockAccountsClearStorage } = vi.hoisted(() => ({
    mockAccountsResetState: vi.fn(),
    mockAccountsClearStorage: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: Object.assign(vi.fn(), {
        getState: () => ({ resetState: mockAccountsResetState }),
        persist: { clearStorage: mockAccountsClearStorage },
    }),
}))

describe('useDeleteAllData', () => {
    const mockDeleteKey = vi.fn()
    const mockRemoveQueries = vi.fn()
    const mockDeleteDevices = vi.fn()
    const mockSavePin = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useKMS as Mock).mockReturnValue({
            keys: new Map([
                ['key-1', { id: 'key-1' }],
                ['key-2', { id: 'key-2' }],
            ]),
            deleteKey: mockDeleteKey,
        })
        ;(usePinCode as Mock).mockReturnValue({
            savePin: mockSavePin,
        })
        ;(useQueryClient as Mock).mockReturnValue({
            removeQueries: mockRemoveQueries,
        })
        ;(useDeleteDeviceMutation as Mock).mockReturnValue({
            mutateAsync: mockDeleteDevices.mockResolvedValue([]),
        })
    })

    it('should delete keys, delete devices, clear PIN, and clear stores except accounts', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)
        expect(mockDeleteKey).toHaveBeenCalledTimes(2)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
        expect(mockDeleteKey).toHaveBeenCalledWith('key-2')
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(mockSavePin).toHaveBeenCalledWith(null)
        expect(clearAllStores).toHaveBeenCalledWith({
            skip: ['accounts-store'],
        })
    })

    it('should clear accounts store when clearAccountsStore is called', () => {
        clearAccountsStore()

        expect(mockAccountsResetState).toHaveBeenCalledTimes(1)
        expect(mockAccountsClearStorage).toHaveBeenCalledTimes(1)
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
            await result.current.deleteAllData()
        })

        expect(mockDeleteKey).toHaveBeenCalledTimes(1)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
    })

    it('should continue if deleteDevices fails', async () => {
        mockDeleteDevices.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    it('should continue if deleteKey fails', async () => {
        mockDeleteKey.mockRejectedValue(new Error('Key deletion error'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDeleteKey).toHaveBeenCalled()
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    it('should handle missing queryClient gracefully', async () => {
        ;(useQueryClient as Mock).mockReturnValue(null)

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockRemoveQueries).not.toHaveBeenCalled()
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    it('should handle missing keys gracefully', async () => {
        ;(useKMS as Mock).mockReturnValue({
            keys: null,
            deleteKey: mockDeleteKey,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDeleteKey).not.toHaveBeenCalled()
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })
})
