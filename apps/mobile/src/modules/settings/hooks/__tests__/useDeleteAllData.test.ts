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
import { clearAllStores, logger } from '@perawallet/wallet-core-shared'
import type { ConnectionRegistry } from '@perawallet/wallet-core-connections'

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
const mockClearConnections = vi.fn().mockResolvedValue(undefined)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    clearDataStores: vi.fn(),
    getProvider: () => ({
        keyValueStorage: { removeItem: mockRemoveItem },
        database: {},
        migration: { resetLegacyData: mockResetLegacyData },
        passkeyAutofill: { clearCredentials: mockClearPasskeyCredentials },
        connections: { store: { clear: mockClearConnections } },
    }),
    clearKeystore: (...args: unknown[]) => mockClearKeystore(...args),
}))

vi.mock('@perawallet/wallet-core-database', () => ({
    clearDatabase: (...args: unknown[]) => mockClearDatabase(...args),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { api: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    clearAllStores: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeleteDeviceMutation: vi.fn(),
}))

// The platform-split legacy sweep: a no-op on native, the browser's real
// session teardown on web (see `useLegacySessionsWipe`). Mocked here so the
// wipe's ordering and its independent guards are asserted whichever twin the
// platform resolves.
const mockDeleteAllSessions = vi.fn().mockResolvedValue(undefined)
vi.mock('../useLegacySessionsWipe', () => ({
    useLegacySessionsWipe: () => ({
        deleteAllSessions: mockDeleteAllSessions,
    }),
}))

// `useOptionalConnectionRegistry` returns `null` when `ConnectionsProvider`
// isn't mounted above the caller — the duress wipe's real situation, since
// `AutoLockGuard` sits above it. Tests that need a live registry override
// this per-test with `mockReturnValue`.
const mockDisconnectAll = vi.fn().mockResolvedValue(undefined)
const mockUseOptionalConnectionRegistry = vi.fn<
    () => Pick<ConnectionRegistry, 'disconnectAll'> | null
>(() => null)
// The module-level accessor the provider publishes to, which is how the
// duress path reaches a registry it cannot see through context.
const mockGetActiveConnectionRegistry = vi.fn<
    () => Pick<ConnectionRegistry, 'disconnectAll'> | null
>(() => null)
vi.mock('@modules/connections', () => ({
    useOptionalConnectionRegistry: () => mockUseOptionalConnectionRegistry(),
    getActiveConnectionRegistry: () => mockGetActiveConnectionRegistry(),
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
        // `clearAllMocks` clears call history but not a prior test's
        // `mockReturnValue` — reset explicitly so "no provider mounted" is
        // this file's default and each test that needs a live registry opts
        // in for itself.
        mockUseOptionalConnectionRegistry.mockReturnValue(null)
        mockGetActiveConnectionRegistry.mockReturnValue(null)
        mockDisconnectAll.mockResolvedValue(undefined)
        mockClearConnections.mockResolvedValue(undefined)
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
        expect(logger.error).toHaveBeenCalledWith(
            'Failed to clear native passkey autofill state',
            expect.anything(),
        )
    })

    // iOS `clearCredentials` ends with an identity-store sync that rejects
    // with `storeDisabled` when the user never enabled Pera as a provider —
    // the state clearing itself has already completed by then, so this is an
    // expected state on every such erase, not a fault for the crash reporter.
    it('does not report an error when the identity store is disabled during the passkey clear', async () => {
        mockClearPasskeyCredentials.mockRejectedValueOnce(
            new Error(
                'The operation couldn’t be completed. (ASCredentialIdentityStoreErrorDomain error 1.)',
            ),
        )

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(logger.error).not.toHaveBeenCalledWith(
            'Failed to clear native passkey autofill state',
            expect.anything(),
        )
        expect(logger.warn).toHaveBeenCalled()
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

    // The duress wipe runs from `AutoLockGuard`, which sits ABOVE
    // `ConnectionsProvider`, so this is a real production path. The registry
    // sweep must be skipped without throwing, and the rest of the wipe
    // (including the legacy WalletConnect sweep) must still run.
    it('skips the registry sweep and still completes the wipe when no connection registry is mounted', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDisconnectAll).not.toHaveBeenCalled()
        expect(mockDeleteAllSessions).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    // The duress wipe's real shape: no provider above the call site, but the
    // app has one mounted elsewhere in the tree, so the v1 sockets and their
    // session keys are live and only `disconnectAll` says goodbye to the peer
    // — `store.clear()` alone leaves the dApp with a dead session it still
    // believes in.
    it('sweeps the active registry when no provider is mounted above the caller', async () => {
        mockGetActiveConnectionRegistry.mockReturnValue({
            disconnectAll: mockDisconnectAll,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDisconnectAll).toHaveBeenCalledTimes(1)
        expect(mockClearConnections).toHaveBeenCalledTimes(1)
    })

    it('prefers the context registry over the module-level one', async () => {
        const contextDisconnectAll = vi.fn().mockResolvedValue(undefined)
        mockUseOptionalConnectionRegistry.mockReturnValue({
            disconnectAll: contextDisconnectAll,
        })
        mockGetActiveConnectionRegistry.mockReturnValue({
            disconnectAll: mockDisconnectAll,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(contextDisconnectAll).toHaveBeenCalledTimes(1)
        expect(mockDisconnectAll).not.toHaveBeenCalled()
    })

    // The backstop for exactly the path above. Connection records are NOT in
    // the `clearAllStores` registry the legacy WalletConnect blob was in, so
    // without this clear a duress wipe — which never has a registry to sweep
    // with — would leave every paired dApp on disk.
    it('clears the connections store even when no registry is mounted', async () => {
        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDisconnectAll).not.toHaveBeenCalled()
        expect(mockClearConnections).toHaveBeenCalledTimes(1)
    })

    it('clears the connections store after sweeping a mounted registry', async () => {
        mockUseOptionalConnectionRegistry.mockReturnValue({
            disconnectAll: mockDisconnectAll,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        // Peers are notified first, then the records go — a clear that ran
        // first would leave `disconnectAll` with nothing to enumerate.
        expect(mockDisconnectAll).toHaveBeenCalledTimes(1)
        expect(mockClearConnections).toHaveBeenCalledTimes(1)
        expect(mockDisconnectAll.mock.invocationCallOrder[0]).toBeLessThan(
            mockClearConnections.mock.invocationCallOrder[0],
        )
    })

    it('continues the wipe when clearing the connections store fails', async () => {
        mockClearConnections.mockRejectedValueOnce(new Error('store locked'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockClearConnections).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    it('calls registry.disconnectAll when a connection registry is mounted', async () => {
        mockUseOptionalConnectionRegistry.mockReturnValue({
            disconnectAll: mockDisconnectAll,
        })

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDisconnectAll).toHaveBeenCalledTimes(1)
        expect(mockDeleteAllSessions).toHaveBeenCalledTimes(1)
    })

    // Mirrors "should continue if WalletConnect disconnect fails": the two
    // sweeps are independently guarded, so a failure in either must not skip
    // the rest of the wipe — nor the OTHER sweep.
    it('continues the wipe when the connection registry sweep fails', async () => {
        mockUseOptionalConnectionRegistry.mockReturnValue({
            disconnectAll: mockDisconnectAll,
        })
        mockDisconnectAll.mockRejectedValueOnce(new Error('peer unreachable'))

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDisconnectAll).toHaveBeenCalledTimes(1)
        expect(mockDeleteAllSessions).toHaveBeenCalledTimes(1)
        expect(mockDeleteDevices).toHaveBeenCalledTimes(1)
    })

    // The inverse of the above: a failing legacy sweep must not skip the
    // registry sweep either — each guard is independent of the other.
    it('still runs the registry sweep when the legacy WalletConnect sweep fails', async () => {
        mockUseOptionalConnectionRegistry.mockReturnValue({
            disconnectAll: mockDisconnectAll,
        })
        mockDeleteAllSessions.mockRejectedValueOnce(
            new Error('WC disconnect error'),
        )

        const { result } = renderHook(() => useDeleteAllData())

        await act(async () => {
            await result.current.deleteAllData()
        })

        expect(mockDeleteAllSessions).toHaveBeenCalledTimes(1)
        expect(mockDisconnectAll).toHaveBeenCalledTimes(1)
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
