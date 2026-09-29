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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

const AUTH_PUBLIC_KEY = new Uint8Array(32).fill(3)

const {
    deriveBackupKeysMock,
    buildBackupRegisterProofMock,
    registerBackupMock,
} = vi.hoisted(() => ({
    deriveBackupKeysMock: vi.fn(),
    buildBackupRegisterProofMock: vi.fn(),
    registerBackupMock: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../crypto', () => ({
    deriveBackupKeys: deriveBackupKeysMock,
    buildBackupRegisterProof: buildBackupRegisterProofMock,
}))
vi.mock('../../api', () => ({
    registerBackup: registerBackupMock,
}))

import { registerCloudBackup } from '../registerCloudBackup'

const PARAMS = {
    mnemonic: ['abandon', 'ability', 'able'],
    salt: 'c2FsdA==',
    deviceId: 'device-123',
    network: 'mainnet' as const,
}

const derivedKeys = () => ({
    backupId: 'did:pera:abc',
    encryptionKey: new Uint8Array(32).fill(5),
    authPublicKey: AUTH_PUBLIC_KEY,
    authSecretKey: new Uint8Array(64).fill(4),
    itemKey: new Uint8Array(32).fill(6),
})

describe('registerCloudBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        deriveBackupKeysMock.mockResolvedValue(derivedKeys())
        buildBackupRegisterProofMock.mockReturnValue({
            nonce: '1700000000000.nonce',
            signature: 'sig==',
        })
        registerBackupMock.mockResolvedValue({ ok: true })
    })

    test('registers the backup with the signed proof', async () => {
        await registerCloudBackup(PARAMS)

        expect(buildBackupRegisterProofMock).toHaveBeenCalledWith({
            backupId: 'did:pera:abc',
            deviceId: 'device-123',
            publicKey: encodeToBase64(AUTH_PUBLIC_KEY),
            authSecretKey: expect.any(Uint8Array),
        })
        expect(registerBackupMock).toHaveBeenCalledWith('mainnet', {
            backup_id: 'did:pera:abc',
            public_key: encodeToBase64(AUTH_PUBLIC_KEY),
            device_id: 'device-123',
            nonce: '1700000000000.nonce',
            wallet_signature: 'sig==',
        })
    })

    test('returns live key material for the caller to retain', async () => {
        const keys = derivedKeys()
        deriveBackupKeysMock.mockResolvedValue(keys)

        const result = await registerCloudBackup(PARAMS)

        expect(result.backupId).toBe('did:pera:abc')
        expect(Array.from(result.encryptionKey)).toEqual(
            Array.from(new Uint8Array(32).fill(5)),
        )
        expect(Array.from(result.authSecretKey)).toEqual(
            Array.from(new Uint8Array(64).fill(4)),
        )
        expect(Array.from(result.itemKey)).toEqual(
            Array.from(new Uint8Array(32).fill(6)),
        )
    })

    test('zeroes the derived secrets and rethrows when register fails', async () => {
        const keys = derivedKeys()
        deriveBackupKeysMock.mockResolvedValue(keys)
        registerBackupMock.mockRejectedValue(new Error('network down'))

        await expect(registerCloudBackup(PARAMS)).rejects.toThrow(
            'network down',
        )

        expect(keys.encryptionKey.every(byte => byte === 0)).toBe(true)
        expect(keys.authSecretKey.every(byte => byte === 0)).toBe(true)
        expect(keys.itemKey.every(byte => byte === 0)).toBe(true)
    })
})
