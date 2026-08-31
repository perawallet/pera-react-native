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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const deriveBackupKeys = vi.fn()
const persistBackupKeys = vi.fn()
const deleteBackupKeys = vi.fn()
const pullBackupItems = vi.fn()
const setConfigured = vi.fn()
const setSyncState = vi.fn()
const importAccounts = vi.fn()

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    deriveBackupKeys: (...a: unknown[]) => deriveBackupKeys(...a),
    persistBackupKeys: (...a: unknown[]) => persistBackupKeys(...a),
    deleteBackupKeys: (...a: unknown[]) => deleteBackupKeys(...a),
    pullBackupItems: (...a: unknown[]) => pullBackupItems(...a),
    createEmptySyncState: (backupId: string) => ({ backupId, items: {} }),
    useCloudBackupStore: (sel: (s: unknown) => unknown) =>
        sel({ setConfigured }),
    useBackupSyncStateStore: (sel: (s: unknown) => unknown) =>
        sel({ setSyncState }),
}))
vi.mock('../useCloudBackupImport', () => ({
    useCloudBackupImport: () => ({ importAccounts }),
}))
vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<object>()),
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-1',
}))
vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    zeroBytes: vi.fn(),
}))

import { useRestoreCloudBackup } from '../useRestoreCloudBackup'

const keys = {
    backupId: 'did:pera:ADDR',
    encryptionKey: new Uint8Array(32),
    authPublicKey: new Uint8Array(32),
    authSecretKey: new Uint8Array(64),
}

describe('useRestoreCloudBackup', () => {
    beforeEach(() => {
        deriveBackupKeys.mockReset().mockResolvedValue(keys)
        persistBackupKeys.mockReset().mockResolvedValue(undefined)
        deleteBackupKeys.mockReset().mockResolvedValue(undefined)
        pullBackupItems.mockReset()
        setConfigured.mockReset()
        setSyncState.mockReset()
        importAccounts
            .mockReset()
            .mockResolvedValue({ imported: 1, skippedDuplicate: 0, failed: [] })
    })

    it('restores successfully and marks configured', async () => {
        pullBackupItems.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 10,
            accounts: [
                { address: 'A', addressPayload: {}, secretsPayload: null },
            ],
            skipped: [],
        })
        const onSuccess = vi.fn()
        const { result } = renderHook(() =>
            useRestoreCloudBackup({ onSuccess, onError: vi.fn() }),
        )
        await act(async () => {
            await result.current.restore({ mnemonic: ['a'], salt: 'c2FsdA==' })
        })
        expect(persistBackupKeys).toHaveBeenCalled()
        expect(importAccounts).toHaveBeenCalled()
        expect(setConfigured).toHaveBeenCalledWith({
            backupId: 'did:pera:ADDR',
            salt: 'c2FsdA==',
        })
        expect(setSyncState).toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalled()
    })

    it('maps a 404 to NOT_FOUND and cleans up keys', async () => {
        pullBackupItems.mockRejectedValue({
            status: 404,
            data: { error: 'BACKUP_NOT_FOUND' },
        })
        const onError = vi.fn()
        const { result } = renderHook(() =>
            useRestoreCloudBackup({ onSuccess: vi.fn(), onError }),
        )
        await act(async () => {
            await result.current.restore({ mnemonic: ['a'], salt: 'c2FsdA==' })
        })
        expect(deleteBackupKeys).toHaveBeenCalled()
        expect(setConfigured).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith('NOT_FOUND')
    })

    it('maps a 401 to INVALID_CREDENTIALS', async () => {
        pullBackupItems.mockRejectedValue({
            status: 401,
            data: { error: 'AUTH_FAILED' },
        })
        const onError = vi.fn()
        const { result } = renderHook(() =>
            useRestoreCloudBackup({ onSuccess: vi.fn(), onError }),
        )
        await act(async () => {
            await result.current.restore({ mnemonic: ['a'], salt: 'c2FsdA==' })
        })
        expect(deleteBackupKeys).toHaveBeenCalled()
        expect(setConfigured).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith('INVALID_CREDENTIALS')
    })

    it('reports a failed key derivation instead of rejecting', async () => {
        // What a truncated paste of the base64 encryption key actually does.
        deriveBackupKeys.mockRejectedValue(
            new Error('Invalid string. Length must be a multiple of 4'),
        )
        const onError = vi.fn()
        const { result } = renderHook(() =>
            useRestoreCloudBackup({ onSuccess: vi.fn(), onError }),
        )

        await act(async () => {
            await expect(
                result.current.restore({ mnemonic: ['a'], salt: 'nope' }),
            ).resolves.toBeUndefined()
        })

        expect(onError).toHaveBeenCalledWith('INVALID_CREDENTIALS')
        expect(persistBackupKeys).not.toHaveBeenCalled()
        expect(pullBackupItems).not.toHaveBeenCalled()
    })
})
