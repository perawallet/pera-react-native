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

// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest'
import nacl from 'tweetnacl'

const keypair = nacl.sign.keyPair()
const queryClientMock = vi.fn().mockResolvedValue({ data: { ok: true } })
const withBackupAuthSecretKeyMock = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: (...args: unknown[]) => queryClientMock(...args),
}))
vi.mock('../../credentials/keyStorage', () => ({
    withBackupAuthSecretKey: (handler: (b: Uint8Array) => unknown) =>
        withBackupAuthSecretKeyMock(handler),
}))

import {
    signedBackupRequest,
    BackupAuthKeyMissingError,
} from '../signedRequest'
import { buildBackupRequestMessage } from '../../crypto/buildBackupRequestProof'

describe('signedBackupRequest', () => {
    beforeEach(() => {
        queryClientMock.mockClear()
        // Default: a key is available, so the proof is built over its bytes.
        withBackupAuthSecretKeyMock.mockImplementation(
            (handler: (b: Uint8Array) => unknown) => handler(keypair.secretKey),
        )
    })

    it('attaches signed auth headers and percent-encodes the backupId in the url', async () => {
        await signedBackupRequest({
            network: 'mainnet',
            method: 'GET',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/manifest',
            deviceId: 'device-1',
        })

        const config = queryClientMock.mock.calls[0][0]
        expect(config.url).toBe('/api/v3/backup/did%3Apera%3AADDR/manifest')
        expect(config.headers['x-backup-id']).toBe('did:pera:ADDR')
        expect(config.headers['x-device-id']).toBe('device-1')
        expect(typeof config.headers['x-nonce']).toBe('string')

        const message = buildBackupRequestMessage({
            method: 'GET',
            path: '/api/v3/backup/did:pera:ADDR/manifest',
            body: undefined,
            nonce: config.headers['x-nonce'],
        })
        const ok = nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            Buffer.from(config.headers['x-signature'], 'base64'),
            keypair.publicKey,
        )
        expect(ok).toBe(true)
    })

    it('sends and hashes the same body bytes for POST', async () => {
        await signedBackupRequest({
            network: 'mainnet',
            method: 'POST',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/items/read',
            deviceId: 'device-1',
            data: { keys: ['accounts/ADDR'] },
        })
        const config = queryClientMock.mock.calls[0][0]
        expect(config.body).toBe('{"keys":["accounts/ADDR"]}')
        expect(config.data).toBeUndefined()
    })

    it('forwards query params without including them in the signed path', async () => {
        await signedBackupRequest({
            network: 'mainnet',
            method: 'GET',
            backupId: 'did:pera:ADDR',
            pathSuffix: '/delta',
            deviceId: 'device-1',
            params: { from_seq: 0 },
        })

        const config = queryClientMock.mock.calls[0][0]
        expect(config.params).toEqual({ from_seq: 0 })

        // The signature is built over the path WITHOUT the query string.
        const message = buildBackupRequestMessage({
            method: 'GET',
            path: '/api/v3/backup/did:pera:ADDR/delta',
            body: undefined,
            nonce: config.headers['x-nonce'],
        })
        const ok = nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            Buffer.from(config.headers['x-signature'], 'base64'),
            keypair.publicKey,
        )
        expect(ok).toBe(true)
    })

    it('throws BackupAuthKeyMissingError when no auth key is stored', async () => {
        withBackupAuthSecretKeyMock.mockResolvedValue(null)

        await expect(
            signedBackupRequest({
                network: 'mainnet',
                method: 'GET',
                backupId: 'did:pera:ADDR',
                pathSuffix: '/manifest',
                deviceId: 'device-1',
            }),
        ).rejects.toBeInstanceOf(BackupAuthKeyMissingError)
        expect(queryClientMock).not.toHaveBeenCalled()
    })
})
