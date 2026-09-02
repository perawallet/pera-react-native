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

const mockRemoveItem = vi.fn()
const mockClearKeystore = vi.fn().mockResolvedValue(undefined)
const mockClearDatabase = vi.fn().mockResolvedValue(undefined)
const mockResetLegacyData = vi.fn().mockResolvedValue(undefined)
const mockClearPasskeyCredentials = vi.fn().mockResolvedValue(undefined)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    clearDataStores: vi.fn(),
    getProvider: () => ({
        keyValueStorage: { removeItem: mockRemoveItem },
        database: {},
        migration: { resetLegacyData: mockResetLegacyData },
        passkeyAutofill: { clearCredentials: mockClearPasskeyCredentials },
    }),
    clearKeystore: (...args: unknown[]) => mockClearKeystore(...args),
}))

vi.mock('@perawallet/wallet-core-database', () => ({
    clearDatabase: (...args: unknown[]) => mockClearDatabase(...args),
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

const mockDeleteAllSessions = vi.fn().mockResolvedValue(undefined)
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({
        deleteAllSessions: mockDeleteAllSessions,
    }),
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
    const mockCancelQueries = vi.fn().mockResolvedValue(undefined)
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
            cancelQueries: mockCancelQueries,
        })
        ;(useDeleteDeviceMutation as Mock).mockReturnValue({
            mutateAsync: mockDeleteDevices.mockResolvedValue([]),
        })
    })

    it('should delete keys, delete devices, clear PIN, and clear ALL stores including accounts', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)
        expect(mockRemoveItem).toHaveBeenCalledWith('reactQuery')
        expect(mockDeleteKey).toHaveBeenCalledTimes(2)
        expect(mockDeleteKey).toHaveBeenCalledWith('key-1')
        expect(mockDeleteKey).toHaveBeenCalledWith('key-2')
        expect(mockClearKeystore).toHaveBeenCalledTimes(1)
        expect(mockDeleteAllSessions).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(mockSavePin).toHaveBeenCalledWith(null)
        // Wipe must empty the live DB in place — never close/delete/reopen the
        // connection, which would free the native handle out from under any
        // in-flight statement and crash libexpo-sqlite.so [PERA crash fix].
        expect(mockClearDatabase).toHaveBeenCalledTimes(1)
        expect(mockResetLegacyData).toHaveBeenCalledTimes(1)
        expect(clearAllStores).toHaveBeenCalledWith()
    })

    it('cancels in-flight queries before teardown and removes the cache only after stores are cleared', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockCancelQueries).toHaveBeenCalledTimes(1)
        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)

        // Cancelling happens before stores are cleared (aborts in-flight
        // fetches); the cache is removed only after, so React Query can't
        // recreate and refetch an observed query against the deleted database.
        const cancelOrder = mockCancelQueries.mock.invocationCallOrder[0]
        const clearOrder = (clearAllStores as Mock).mock.invocationCallOrder[0]
        const removeOrder = mockRemoveQueries.mock.invocationCallOrder[0]
        expect(cancelOrder).toBeLessThan(clearOrder)
        expect(removeOrder).toBeGreaterThan(clearOrder)
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

        expect(mockCancelQueries).not.toHaveBeenCalled()
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

    // The credential providers keep their own copy of the master key, parent
    // key id, and stored credentials (iOS app-group/keychain, Android MMKV) —
    // none of it dies with the keystore, so the wipe must clear it explicitly.
    it('clears the native passkey autofill state', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockClearPasskeyCredentials).toHaveBeenCalledTimes(1)
    })

    it('should continue if clearing native passkey autofill state fails', async () => {
        mockClearPasskeyCredentials.mockRejectedValueOnce(
            new Error('native passkey clear error'),
        )

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockClearPasskeyCredentials).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
        expect(clearAllStores).toHaveBeenCalledWith()
    })

    it('should continue if clearKeystore fails', async () => {
        mockClearKeystore.mockRejectedValueOnce(new Error('Keystore error'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockClearKeystore).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    it('should continue if WalletConnect disconnect fails', async () => {
        mockDeleteAllSessions.mockRejectedValueOnce(
            new Error('WC disconnect error'),
        )

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDeleteAllSessions).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    it('should continue if database clear fails', async () => {
        mockClearDatabase.mockRejectedValueOnce(new Error('DB clear error'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockClearDatabase).toHaveBeenCalledTimes(1)
        expect(clearAllStores).toHaveBeenCalledWith()
    })

    it('should continue if legacy migration reset fails', async () => {
        mockResetLegacyData.mockRejectedValueOnce(
            new Error('legacy reset error'),
        )

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockResetLegacyData).toHaveBeenCalledTimes(1)
        expect(clearAllStores).toHaveBeenCalledWith()
    })
})
