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

import { describe, test, expect, vi } from 'vitest'

// Argon2id is native-only; mock it to a fixed master key (0x01..0x20) so the
// orchestration is deterministic and the downstream HKDF/Ed25519 vectors match
// the per-unit specs.
// Params are spelled out so `mock.calls` keeps its tuple shape and the salt
// and config assertions below can index into it.
const { deriveBackupMasterKeyMock } = vi.hoisted(() => ({
    deriveBackupMasterKeyMock: vi.fn(
        async (
            _password: Uint8Array,
            _salt: Uint8Array,
            _config?: unknown,
        ): Promise<Uint8Array> =>
            new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)),
    ),
}))

vi.mock('../deriveBackupMasterKey', () => ({
    deriveBackupMasterKey: deriveBackupMasterKeyMock,
}))

// Spied, not replaced, so a test can inspect the real keys each step produced
// or make one step fail.
vi.mock('../deriveBackupChildKeys', async importOriginal => {
    const actual =
        await importOriginal<typeof import('../deriveBackupChildKeys')>()
    return {
        ...actual,
        deriveBackupChildKeys: vi.fn(actual.deriveBackupChildKeys),
    }
})
vi.mock('../deriveBackupAuthKeypair', async importOriginal => {
    const actual =
        await importOriginal<typeof import('../deriveBackupAuthKeypair')>()
    return {
        ...actual,
        deriveBackupAuthKeypair: vi.fn(actual.deriveBackupAuthKeypair),
    }
})
vi.mock('../deriveBackupId', async importOriginal => {
    const actual = await importOriginal<typeof import('../deriveBackupId')>()
    return { ...actual, deriveBackupId: vi.fn(actual.deriveBackupId) }
})

import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { deriveBackupKeys } from '../deriveBackupKeys'
import {
    deriveBackupAuthKeypair,
    type BackupAuthKeypair,
} from '../deriveBackupAuthKeypair'
import {
    deriveBackupChildKeys,
    type BackupChildKeys,
} from '../deriveBackupChildKeys'
import { deriveBackupId } from '../deriveBackupId'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

const SALT = encodeToBase64(new Uint8Array(16).fill(9))

describe('deriveBackupKeys', () => {
    test('derives backupId and child keys from mnemonic + salt', async () => {
        const result = await deriveBackupKeys({
            mnemonic: ['abandon', 'ability', 'able'],
            salt: SALT,
        })

        expect(result.backupId).toBe(
            'did:pera:DACRSHIYIZJMAW7C42ORH2BNF54SPP4SF6B5A4ZB47OMOLPY3QXUX3WV54',
        )
        expect(hex(result.encryptionKey)).toBe(
            '31b53a4316ec4c91873d458a6f151a5696ea6342e92bcfa8ef478eeb38f228a3',
        )
        expect(hex(result.authPublicKey)).toBe(
            '1805191d184652c05be2e69d13e82d2f7927bf922f83d07321e7dcc72df8dc2f',
        )
        expect(hex(result.itemKey)).toBe(
            '9b31d9b9a9a0b3067f326f34df91cb80b835d0d443bbd0778d1784af4656cbac',
        )
    })

    test('feeds the decoded salt bytes into the master-key derivation', async () => {
        await deriveBackupKeys({ mnemonic: ['abandon'], salt: SALT })

        const saltArg = deriveBackupMasterKeyMock.mock.calls.at(-1)?.[1]
        expect(saltArg).toEqual(new Uint8Array(16).fill(9))
    })

    test('passes a supplied argon2id config through to the derivation', async () => {
        const argon2id = {
            timeCost: 4,
            memoryCost: 128,
            parallelism: 2,
            outputLength: 32,
        }

        await deriveBackupKeys({ mnemonic: ['abandon'], salt: SALT, argon2id })

        expect(deriveBackupMasterKeyMock.mock.calls.at(-1)?.[2]).toEqual(
            argon2id,
        )
    })

    // Undefined rather than ARGON2ID_CONFIG: the default lives on
    // `deriveBackupMasterKey`, so restating it here would let the two drift
    // apart without failing.
    test('leaves the config unset when none is supplied', async () => {
        await deriveBackupKeys({ mnemonic: ['abandon'], salt: SALT })

        expect(deriveBackupMasterKeyMock.mock.calls.at(-1)?.[2]).toBeUndefined()
    })

    const isZeroed = (bytes: Uint8Array) => bytes.every(byte => byte === 0)
    const lastChildKeys = (): BackupChildKeys =>
        vi.mocked(deriveBackupChildKeys).mock.results.at(-1)!.value

    test('zeroes the master key and auth seed once the keys are returned', async () => {
        const keys = await deriveBackupKeys({
            mnemonic: ['abandon'],
            salt: SALT,
        })

        const masterKey: Uint8Array =
            await deriveBackupMasterKeyMock.mock.results.at(-1)!.value
        expect(isZeroed(masterKey)).toBe(true)
        expect(isZeroed(lastChildKeys().authSeed)).toBe(true)
        expect(isZeroed(keys.encryptionKey)).toBe(false)
        expect(isZeroed(keys.itemKey)).toBe(false)
        expect(isZeroed(keys.authSecretKey)).toBe(false)
    })

    test('zeroes every child key when the auth keypair derivation throws', async () => {
        vi.mocked(deriveBackupAuthKeypair).mockImplementationOnce(() => {
            throw new Error('keypair failed')
        })

        await expect(
            deriveBackupKeys({ mnemonic: ['abandon'], salt: SALT }),
        ).rejects.toThrow('keypair failed')

        const childKeys = lastChildKeys()
        expect(isZeroed(childKeys.encryptionKey)).toBe(true)
        expect(isZeroed(childKeys.authSeed)).toBe(true)
        expect(isZeroed(childKeys.itemKey)).toBe(true)
    })

    test('zeroes the child keys and auth secret key when the backup id throws', async () => {
        vi.mocked(deriveBackupId).mockImplementationOnce(() => {
            throw new Error('id failed')
        })

        await expect(
            deriveBackupKeys({ mnemonic: ['abandon'], salt: SALT }),
        ).rejects.toThrow('id failed')

        const childKeys = lastChildKeys()
        const keypair: BackupAuthKeypair = vi
            .mocked(deriveBackupAuthKeypair)
            .mock.results.at(-1)!.value
        expect(isZeroed(childKeys.encryptionKey)).toBe(true)
        expect(isZeroed(childKeys.authSeed)).toBe(true)
        expect(isZeroed(childKeys.itemKey)).toBe(true)
        expect(isZeroed(keypair.secretKey)).toBe(true)
    })
})
