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
    mockResetCloudBackup,
    mockResetSyncState,
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
    mockResetCloudBackup: vi.fn(),
    mockResetSyncState: vi.fn(),
}))

vi.mock('../syncBackup', () => ({ syncBackup: mockSyncBackup }))
vi.mock('../pullBackupDeltas', () => ({
    pullBackupDeltas: mockPullBackupDeltas,
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
    useCloudBackupStore: {
        getState: () => ({
            backupId: 'backup-123',
            resetState: mockResetCloudBackup,
        }),
    },
    useBackupSyncStateStore: {
        getState: () => ({
            syncState: null,
            setSyncState: mockSetSyncState,
            resetState: mockResetSyncState,
        }),
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: { getState: () => ({ accounts: [] }) },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { backupBaseUrl: 'https://backup.example.com' },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn(), info: vi.fn() },
}))

vi.mock('../../models', () => ({
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
})

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
        expect(onBackupDeleted).toHaveBeenCalledTimes(1)
    })

    it('getBackupSyncManager returns the instance from initializeBackupSyncManager', () => {
        const mgr = initializeBackupSyncManager(makeDeps())
        expect(getBackupSyncManager()).toBe(mgr)
        mgr.stop()
    })
})
