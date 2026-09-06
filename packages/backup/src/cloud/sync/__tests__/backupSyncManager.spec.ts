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

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── module mocks (hoisted) ───────────────────────────────────────────────────

const {
    mockSyncBackup,
    mockPullBackupDeltas,
    mockHasBackupCredentials,
    mockWithBackupEncryptionKey,
    mockWithBackupAuthSecretKey,
    mockDeleteBackupKeys,
    mockConnect,
    mockDisconnect,
    mockSetSyncState,
    mockSetIsSyncing,
    mockResetSyncActivity,
    mockResetCloudBackup,
    mockResetSyncState,
    storedSyncState,
    storedDeviceId,
    accountsState,
    accountsListeners,
    contactsState,
    contactsListeners,
} = vi.hoisted(() => ({
    mockSyncBackup: vi.fn(),
    mockPullBackupDeltas: vi.fn(),
    mockHasBackupCredentials: vi.fn(() => true),
    mockWithBackupEncryptionKey: vi.fn(
        async (fn: (key: Uint8Array) => unknown) => fn(new Uint8Array(32)),
    ),
    mockWithBackupAuthSecretKey: vi.fn(
        async (fn: (key: Uint8Array) => unknown) => fn(new Uint8Array(64)),
    ),
    mockDeleteBackupKeys: vi.fn(async () => undefined),
    mockConnect: vi.fn(async () => undefined),
    mockDisconnect: vi.fn(),
    mockSetSyncState: vi.fn(),
    mockSetIsSyncing: vi.fn(),
    mockResetSyncActivity: vi.fn(),
    mockResetCloudBackup: vi.fn(),
    mockResetSyncState: vi.fn(),
    storedSyncState: { current: null as unknown },
    storedDeviceId: { current: null as string | null },
    accountsState: { current: [] as { address: string; name?: string }[] },
    accountsListeners: {
        current: [] as ((state: { accounts: unknown[] }) => void)[],
    },
    contactsState: { current: [] as { address: string; name: string }[] },
    contactsListeners: {
        current: [] as ((state: { contacts: unknown[] }) => void)[],
    },
}))

vi.mock('../syncBackup', () => ({ syncBackup: mockSyncBackup }))
vi.mock('../pullBackupDeltas', () => ({
    pullBackupDeltas: mockPullBackupDeltas,
}))
// Stubbed like syncBackup above: the real module reaches the API schemas and
// the item cipher, neither of which this spec stands up.
vi.mock('../reviewActions', () => ({
    reviewActionDeps: (deps: unknown) => deps,
    markAccountForBackup: (state: unknown) => state,
    importFromBackup: ({ state }: { state: unknown }) => ({
        state,
        summary: { imported: 1, skippedDuplicate: 0, failed: [] },
    }),
    deleteFromBackup: ({ state }: { state: unknown }) => state,
    keepAccountInBackup: (state: unknown) => state,
}))

vi.mock('../../credentials/keyStorage', () => ({
    hasBackupCredentials: mockHasBackupCredentials,
    withBackupEncryptionKey: mockWithBackupEncryptionKey,
    withBackupAuthSecretKey: mockWithBackupAuthSecretKey,
    deleteBackupKeys: mockDeleteBackupKeys,
}))

vi.mock('../webSocketClient', () => ({
    BackupWebSocketClient: class MockBackupWebSocketClient {
        connect = mockConnect
        disconnect = mockDisconnect
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: { getState: () => ({ network: 'mainnet' }) },
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: {
        getState: () => ({ deviceIDs: new Map([['mainnet', 'dev-id']]) }),
    },
}))

vi.mock('../../store', () => ({
    // Mirrors the real rule against the two fixtures above; the rule itself is
    // covered in the resolver's own spec.
    resolveBackupDeviceId: () => storedDeviceId.current ?? 'dev-id',
    useCloudBackupStore: {
        getState: () => ({
            backupId: 'backup-123',
            deviceId: storedDeviceId.current,
            resetState: mockResetCloudBackup,
        }),
    },
    useBackupSyncStateStore: {
        getState: () => ({
            syncState: storedSyncState.current,
            setSyncState: mockSetSyncState,
            resetState: mockResetSyncState,
        }),
    },
    useBackupSyncActivityStore: {
        getState: () => ({
            setIsSyncing: mockSetIsSyncing,
            resetState: mockResetSyncActivity,
        }),
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({ accounts: accountsState.current }),
        subscribe: (listener: (state: { accounts: unknown[] }) => void) => {
            accountsListeners.current.push(listener)
            return () => {
                accountsListeners.current = accountsListeners.current.filter(
                    entry => entry !== listener,
                )
            }
        },
    },
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: {
        getState: () => ({ contacts: contactsState.current }),
        subscribe: (listener: (state: { contacts: unknown[] }) => void) => {
            contactsListeners.current.push(listener)
            return () => {
                contactsListeners.current = contactsListeners.current.filter(
                    entry => entry !== listener,
                )
            }
        },
    },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { backupBaseUrl: 'https://backup.example.com' },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn(), info: vi.fn() },
}))

// Partial: the api schemas reachable through the review actions read the real
// BackupItemType / BackupItemStatus enums at module load.
vi.mock('../../models', async importOriginal => ({
    ...(await importOriginal<typeof import('../../models')>()),
    createEmptySyncState: (backupId: string) => ({
        backupId,
        lastSyncResult: 'NONE',
    }),
}))

vi.mock('../../crypto/buildBackupWebSocketToken', () => ({
    buildBackupWebSocketToken: vi.fn(),
}))

// ─── import after mocks ───────────────────────────────────────────────────────

import {
    BackupSyncManager,
    initializeBackupSyncManager,
    getBackupSyncManager,
} from '../backupSyncManager'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeDeps = () => ({
    importAccounts: vi.fn(async () => ({
        imported: 0,
        skippedDuplicate: 0,
        failed: [],
    })),
    importContacts: vi.fn(async () => ({ imported: 0, failed: [] })),
    resolveMnemonic: vi.fn(async () => null),
    resolveHd: vi.fn(async () => null),
})

const setAccounts = (accounts: { address: string; name?: string }[]) => {
    accountsState.current = accounts
    for (const listener of [...accountsListeners.current]) {
        listener({ accounts })
    }
}

const setContacts = (contacts: { address: string; name: string }[]) => {
    contactsState.current = contacts
    for (const listener of [...contactsListeners.current]) {
        listener({ contacts })
    }
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('BackupSyncManager', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mockSyncBackup.mockResolvedValue({
            backupId: 'backup-123',
            lastSyncResult: 'SUCCESS',
        })
        mockPullBackupDeltas.mockResolvedValue({
            backupId: 'backup-123',
            lastSyncResult: 'SUCCESS',
        })
        mockHasBackupCredentials.mockReturnValue(true)
        storedSyncState.current = null
        storedDeviceId.current = null
        accountsState.current = []
        accountsListeners.current = []
        contactsState.current = []
        contactsListeners.current = []
        mockWithBackupEncryptionKey.mockImplementation(
            async (fn: (key: Uint8Array) => unknown) => fn(new Uint8Array(32)),
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('start() with credentials calls syncBackup and connects WebSocket', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.start()
        expect(mockSyncBackup).toHaveBeenCalledTimes(1)
        expect(mockConnect).toHaveBeenCalledTimes(1)
        mgr.stop()
    })

    it('start() without credentials does not call syncBackup or connect', async () => {
        mockHasBackupCredentials.mockReturnValue(false)
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.start()
        expect(mockSyncBackup).not.toHaveBeenCalled()
        expect(mockConnect).not.toHaveBeenCalled()
    })

    it('signs requests with the device id the backup was registered with', async () => {
        storedDeviceId.current = 'registered-device'
        const mgr = new BackupSyncManager(makeDeps())

        await mgr.syncNow()

        expect(mockSyncBackup).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: 'registered-device' }),
            expect.anything(),
        )
    })

    it('falls back to the push device id for backups configured before one was stored', async () => {
        const mgr = new BackupSyncManager(makeDeps())

        await mgr.syncNow()

        expect(mockSyncBackup).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: 'dev-id' }),
            expect.anything(),
        )
    })

    it('records FAILED when the first-ever sync throws', async () => {
        mockSyncBackup.mockRejectedValue(new Error('network down'))
        const mgr = new BackupSyncManager(makeDeps())

        await mgr.syncNow()

        expect(mockSetSyncState).toHaveBeenCalledWith(
            expect.objectContaining({ lastSyncResult: 'FAILED' }),
        )
    })

    it('publishes the syncing flag around a background sync', async () => {
        const mgr = new BackupSyncManager(makeDeps())

        await mgr.syncNow()

        expect(mockSetIsSyncing.mock.calls.map(call => call[0])).toEqual([
            true,
            false,
        ])
    })

    it('publishes the syncing flag around a socket-driven pull', async () => {
        const mgr = new BackupSyncManager(makeDeps())

        await mgr.handleSocketEvent({
            kind: 'itemsUpdated',
            fromSeq: 1,
            toSeq: 2,
        })

        expect(mockSetIsSyncing.mock.calls.map(call => call[0])).toEqual([
            true,
            false,
        ])
    })

    it('clears the syncing flag when the sync throws', async () => {
        mockSyncBackup.mockRejectedValue(new Error('network down'))
        const mgr = new BackupSyncManager(makeDeps())

        await mgr.syncNow()

        expect(mockSetIsSyncing).toHaveBeenLastCalledWith(false)
    })

    it('handleSocketEvent itemsUpdated calls pullBackupDeltas', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.handleSocketEvent({
            kind: 'itemsUpdated',
            fromSeq: 1,
            toSeq: 2,
        })
        expect(mockPullBackupDeltas).toHaveBeenCalledTimes(1)
        mgr.stop()
    })

    it('handleSocketEvent backupDeleted stops syncing, deletes on-device keys, resets stores, and notifies', async () => {
        const onBackupDeleted = vi.fn()
        const mgr = new BackupSyncManager({ ...makeDeps(), onBackupDeleted })
        await mgr.start()
        await mgr.handleSocketEvent({ kind: 'backupDeleted' })
        expect(mockDisconnect).toHaveBeenCalled()
        expect(mockDeleteBackupKeys).toHaveBeenCalledTimes(1)
        expect(mockResetCloudBackup).toHaveBeenCalledTimes(1)
        expect(mockResetSyncState).toHaveBeenCalledTimes(1)
        expect(mockResetSyncActivity).toHaveBeenCalledTimes(1)
        expect(onBackupDeleted).toHaveBeenCalledTimes(1)
    })

    it('keepAccountInBackup persists the reviewed state', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        expect(await mgr.keepAccountInBackup('ADDR')).toBe(true)
        expect(mockSetSyncState).toHaveBeenCalled()
        mgr.stop()
    })

    it('getBackupSyncManager returns the instance from initializeBackupSyncManager', () => {
        const mgr = initializeBackupSyncManager(makeDeps())
        expect(getBackupSyncManager()).toBe(mgr)
        mgr.stop()
    })
})

describe('BackupSyncManager account watcher', () => {
    const ACCOUNT_DEBOUNCE_MS = 2000

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mockSyncBackup.mockResolvedValue({
            backupId: 'backup-123',
            lastSyncResult: 'SUCCESS',
        })
        mockHasBackupCredentials.mockReturnValue(true)
        storedSyncState.current = null
        storedDeviceId.current = null
        accountsState.current = []
        accountsListeners.current = []
        contactsState.current = []
        contactsListeners.current = []
        mockWithBackupEncryptionKey.mockImplementation(
            async (fn: (key: Uint8Array) => unknown) => fn(new Uint8Array(32)),
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('syncs once after the debounce when an account is added', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.start()
        mockSyncBackup.mockClear()

        setAccounts([{ address: 'A' }])
        expect(mockSyncBackup).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)
        expect(mockSyncBackup).toHaveBeenCalledTimes(1)
        mgr.stop()
    })

    it('coalesces a burst of additions into one sync', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.start()
        mockSyncBackup.mockClear()

        setAccounts([{ address: 'A' }])
        setAccounts([{ address: 'A' }, { address: 'B' }])
        setAccounts([{ address: 'A' }, { address: 'B' }, { address: 'C' }])

        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)
        expect(mockSyncBackup).toHaveBeenCalledTimes(1)
        mgr.stop()
    })

    it('syncs when an account is renamed', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        accountsState.current = [{ address: 'A', name: 'Old' }]
        await mgr.start()
        mockSyncBackup.mockClear()

        setAccounts([{ address: 'A', name: 'New' }])
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)

        expect(mockSyncBackup).toHaveBeenCalledTimes(1)
        mgr.stop()
    })

    it('syncs when a contact is added', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.start()
        mockSyncBackup.mockClear()

        setContacts([{ address: 'C1', name: 'Alice' }])
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)

        expect(mockSyncBackup).toHaveBeenCalledTimes(1)
        mgr.stop()
    })

    it('does not sync for a contact write the backup cannot see', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        contactsState.current = [{ address: 'C1', name: 'Alice' }]
        await mgr.start()
        mockSyncBackup.mockClear()

        setContacts([{ address: 'C1', name: 'Alice' }])
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)

        expect(mockSyncBackup).not.toHaveBeenCalled()
        mgr.stop()
    })

    it('does not sync for a store write the backup cannot see', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        accountsState.current = [{ address: 'A', name: 'Same' }]
        await mgr.start()
        mockSyncBackup.mockClear()

        setAccounts([{ address: 'A', name: 'Same' }])
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)

        expect(mockSyncBackup).not.toHaveBeenCalled()
        mgr.stop()
    })

    it('stops watching after stop()', async () => {
        const mgr = new BackupSyncManager(makeDeps())
        await mgr.start()
        mgr.stop()
        mockSyncBackup.mockClear()

        setAccounts([{ address: 'A' }])
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)

        expect(mockSyncBackup).not.toHaveBeenCalled()
    })

    it('still syncs a change that arrived while a sync was running', async () => {
        let release: () => void = () => {}
        mockSyncBackup.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    release = () =>
                        resolve({
                            backupId: 'backup-123',
                            lastSyncResult: 'SUCCESS',
                        })
                }),
        )
        const mgr = new BackupSyncManager(makeDeps())
        const started = mgr.start()

        setAccounts([{ address: 'A' }])
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)
        expect(mockSyncBackup).toHaveBeenCalledTimes(1)

        release()
        await started
        await vi.advanceTimersByTimeAsync(ACCOUNT_DEBOUNCE_MS)

        expect(mockSyncBackup).toHaveBeenCalledTimes(2)
        mgr.stop()
    })
})
