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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

const AUTH_PUBLIC_KEY = new Uint8Array(32).fill(3)
const AUTH_SECRET_KEY = new Uint8Array(64).fill(4)
const ENCRYPTION_KEY = new Uint8Array(32).fill(5)

const {
    deriveBackupKeysMock,
    buildBackupRegisterProofMock,
    persistBackupKeysMock,
    deleteBackupKeysMock,
    registerBackupMock,
} = vi.hoisted(() => ({
    deriveBackupKeysMock: vi.fn(),
    buildBackupRegisterProofMock: vi.fn(),
    persistBackupKeysMock: vi.fn(async () => undefined),
    deleteBackupKeysMock: vi.fn(async () => undefined),
    registerBackupMock: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../crypto', () => ({
    deriveBackupKeys: deriveBackupKeysMock,
    buildBackupRegisterProof: buildBackupRegisterProofMock,
}))
vi.mock('../keyStorage', () => ({
    persistBackupKeys: persistBackupKeysMock,
    deleteBackupKeys: deleteBackupKeysMock,
}))
vi.mock('../../api', () => ({
    registerBackup: registerBackupMock,
}))

import { enableCloudBackup } from '../enableCloudBackup'

const PARAMS = {
    mnemonic: ['abandon', 'ability', 'able'],
    salt: 'c2FsdA==',
    deviceId: 'device-123',
    network: 'mainnet' as const,
}

describe('enableCloudBackup', () => {
    beforeEach(() => {
        deriveBackupKeysMock.mockReset()
        buildBackupRegisterProofMock.mockReset()
        persistBackupKeysMock.mockReset()
        persistBackupKeysMock.mockResolvedValue(undefined)
        deleteBackupKeysMock.mockReset()
        deleteBackupKeysMock.mockResolvedValue(undefined)
        registerBackupMock.mockReset()

        deriveBackupKeysMock.mockResolvedValue({
            backupId: 'did:pera:abc',
            encryptionKey: ENCRYPTION_KEY,
            authPublicKey: AUTH_PUBLIC_KEY,
            authSecretKey: AUTH_SECRET_KEY,
        })
        buildBackupRegisterProofMock.mockReturnValue({
            nonce: '1700000000000.nonce',
            signature: 'sig==',
        })
        registerBackupMock.mockResolvedValue({ ok: true })
    })

    test('persists keys and registers the backup with the signed proof', async () => {
        const result = await enableCloudBackup(PARAMS)

        expect(persistBackupKeysMock).toHaveBeenCalledWith({
            encryptionKey: ENCRYPTION_KEY,
            authSecretKey: AUTH_SECRET_KEY,
            mnemonic: PARAMS.mnemonic,
        })
        expect(registerBackupMock).toHaveBeenCalledWith('mainnet', {
            backup_id: 'did:pera:abc',
            public_key: encodeToBase64(AUTH_PUBLIC_KEY),
            device_id: 'device-123',
            nonce: '1700000000000.nonce',
            wallet_signature: 'sig==',
        })
        expect(buildBackupRegisterProofMock).toHaveBeenCalledWith({
            backupId: 'did:pera:abc',
            deviceId: 'device-123',
            publicKey: encodeToBase64(AUTH_PUBLIC_KEY),
            authSecretKey: AUTH_SECRET_KEY,
        })
        expect(result).toEqual({ backupId: 'did:pera:abc' })
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('persists keys before calling register', async () => {
        const order: string[] = []
        persistBackupKeysMock.mockImplementation(async () => {
            order.push('persist')
        })
        registerBackupMock.mockImplementation(async () => {
            order.push('register')
            return { ok: true }
        })

        await enableCloudBackup(PARAMS)

        expect(order).toEqual(['persist', 'register'])
    })

    test('rolls back persisted keys and rethrows when register fails', async () => {
        const failure = new Error('network down')
        registerBackupMock.mockRejectedValue(failure)

        await expect(enableCloudBackup(PARAMS)).rejects.toThrow('network down')

        expect(persistBackupKeysMock).toHaveBeenCalled()
        expect(deleteBackupKeysMock).toHaveBeenCalledTimes(1)
    })

    test('rethrows the original register error even if cleanup fails', async () => {
        registerBackupMock.mockRejectedValue(new Error('network down'))
        deleteBackupKeysMock.mockRejectedValue(new Error('keystore busy'))

        await expect(enableCloudBackup(PARAMS)).rejects.toThrow('network down')

        expect(deleteBackupKeysMock).toHaveBeenCalledTimes(1)
    })

    test('zeroes the derived secrets after registering', async () => {
        const encryptionKey = new Uint8Array(32).fill(5)
        const authSecretKey = new Uint8Array(64).fill(4)
        deriveBackupKeysMock.mockResolvedValue({
            backupId: 'did:pera:abc',
            encryptionKey,
            authPublicKey: AUTH_PUBLIC_KEY,
            authSecretKey,
        })

        await enableCloudBackup(PARAMS)

        expect(encryptionKey.every(byte => byte === 0)).toBe(true)
        expect(authSecretKey.every(byte => byte === 0)).toBe(true)
    })

    test('zeroes the derived secrets when register fails', async () => {
        const encryptionKey = new Uint8Array(32).fill(5)
        const authSecretKey = new Uint8Array(64).fill(4)
        deriveBackupKeysMock.mockResolvedValue({
            backupId: 'did:pera:abc',
            encryptionKey,
            authPublicKey: AUTH_PUBLIC_KEY,
            authSecretKey,
        })
        registerBackupMock.mockRejectedValue(new Error('network down'))

        await expect(enableCloudBackup(PARAMS)).rejects.toThrow('network down')

        expect(encryptionKey.every(byte => byte === 0)).toBe(true)
        expect(authSecretKey.every(byte => byte === 0)).toBe(true)
    })
})
