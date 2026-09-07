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

import { describe, test, expect, beforeAll, vi } from 'vitest'
import { argon2id } from '@noble/hashes/argon2.js'
import { sha256 } from '@noble/hashes/sha2.js'

type Argon2Params = {
    message: Uint8Array
    nonce: Uint8Array
    parallelism: number
    tagLength: number
    memory: number
    passes: number
}

type Argon2Callback = (error: Error | null, result: Uint8Array) => void

const { argon2Mock, derivations } = vi.hoisted(() => ({
    argon2Mock: vi.fn(),
    // The derived-from bytes are zeroed once the derivation resolves, so they
    // have to be copied as they arrive rather than read back off the mock.
    derivations: [] as { message: Uint8Array; nonce: Uint8Array }[],
}))

// `crypto.argon2` landed in Node 24 and reaches production through
// react-native-quick-crypto, so standing something in its place is the only
// way to run either half of this file here.
vi.mock('crypto', async importOriginal => {
    const actual = await importOriginal<typeof import('crypto')>()
    return { ...actual, argon2: argon2Mock }
})

import { concatBytes, decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    BackupSyncQrError,
    BackupSyncQrUnsupportedVersionError,
    decryptBackupSyncQr,
    encryptBackupSyncQr,
    parseBackupSyncQrEnvelope,
} from '../syncQrPayload'
import { sealAesGcm } from '../aesGcm'
import { ARGON2ID_CONFIG } from '../constants'

const record = (params: Argon2Params) => {
    derivations.push({
        message: Uint8Array.from(params.message),
        nonce: Uint8Array.from(params.nonce),
    })
}

const useProductionArgon2 = () => {
    argon2Mock.mockImplementation(
        (
            _algorithm: string,
            params: Argon2Params,
            callback: Argon2Callback,
        ) => {
            record(params)
            callback(
                null,
                argon2id(params.message, params.nonce, {
                    t: params.passes,
                    m: params.memory,
                    p: params.parallelism,
                    dkLen: params.tagLength,
                }),
            )
        },
    )
}

// Key-agnostic cases turn on the envelope and the AEAD, not on the KDF, so a
// deterministic stand-in buys back four real 256 MiB derivations without
// weakening an assertion. It stays sensitive to both inputs, which is all the
// wrong-code and fresh-salt cases need.
const useStandInKdf = () => {
    argon2Mock.mockImplementation(
        (
            _algorithm: string,
            params: Argon2Params,
            callback: Argon2Callback,
        ) => {
            record(params)
            callback(
                null,
                sha256(concatBytes(params.message, params.nonce)).slice(
                    0,
                    params.tagLength,
                ),
            )
        },
    )
}

const MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const BACKUP_SALT = 'c2FsdHktc2FsdC0xNi1ieXRlcw=='
const CODE = '123456'

// A real Argon2id at 256 MiB runs for seconds per derive under the pure-JS
// stand-in, and the block below derives twice.
const TIMEOUT = 60_000

const SERIALIZED_CONFIG = {
    time_cost: ARGON2ID_CONFIG.timeCost,
    memory_cost: ARGON2ID_CONFIG.memoryCost,
    parallelism: ARGON2ID_CONFIG.parallelism,
    output_length: ARGON2ID_CONFIG.outputLength,
}

// The inner config rides inside the ciphertext, so forging one means resealing
// under the key the stand-in KDF gives this envelope's salt.
const resealWith = (envelope: string, contents: Record<string, unknown>) => {
    const parsed = JSON.parse(envelope)
    const key = sha256(
        concatBytes(
            new TextEncoder().encode(CODE),
            decodeFromBase64(parsed.kdf.salt),
        ),
    ).slice(0, ARGON2ID_CONFIG.outputLength)

    return JSON.stringify({
        ...parsed,
        payload: sealAesGcm(
            JSON.stringify(contents),
            key,
            new TextEncoder().encode('backup-sync|1'),
        ),
    })
}

const seal = () =>
    encryptBackupSyncQr({
        mnemonic: MNEMONIC,
        backupSalt: BACKUP_SALT,
        code: CODE,
    })

describe('backup sync QR payload', () => {
    describe('under the production Argon2id', () => {
        let envelope: string

        beforeAll(async () => {
            useProductionArgon2()
            derivations.length = 0
            envelope = await seal()
        }, TIMEOUT)

        test(
            'round trips the mnemonic, salt and config',
            async () => {
                const opened = await decryptBackupSyncQr(envelope, CODE)

                expect(opened.mnemonic).toBe(MNEMONIC)
                expect(opened.backupSalt).toBe(BACKUP_SALT)
                expect(opened.argon2id).toEqual(ARGON2ID_CONFIG)
            },
            TIMEOUT,
        )

        test('carries the kdf parameters in clear so a scanner can reproduce the key', () => {
            const parsed = JSON.parse(envelope)

            expect(parsed.v).toBe(1)
            expect(parsed.t).toBe('backup-sync')
            expect(parsed.kdf.time_cost).toBe(ARGON2ID_CONFIG.timeCost)
            expect(parsed.kdf.memory_cost).toBe(ARGON2ID_CONFIG.memoryCost)
            expect(typeof parsed.kdf.salt).toBe('string')
            expect(typeof parsed.payload).toBe('string')
        })

        test('leaks nothing about the mnemonic in the clear part', () => {
            expect(envelope).not.toContain('abandon')
            expect(envelope).not.toContain(BACKUP_SALT)
        })

        test('derives the key from the QR salt, never from the backup salt', () => {
            const { kdf } = JSON.parse(envelope)

            expect(derivations[0].nonce).toEqual(decodeFromBase64(kdf.salt))
            expect(derivations[0].nonce).not.toEqual(
                decodeFromBase64(BACKUP_SALT),
            )
            expect(derivations[0].message).toEqual(
                new TextEncoder().encode(CODE),
            )
        })
    })

    describe('under a stand-in KDF', () => {
        let envelope: string

        beforeAll(async () => {
            useStandInKdf()
            envelope = await seal()
        })

        test('rejects a wrong code', async () => {
            await expect(
                decryptBackupSyncQr(envelope, '654321'),
            ).rejects.toBeInstanceOf(BackupSyncQrError)
        })

        test('rejects tampered ciphertext', async () => {
            const parsed = JSON.parse(envelope)
            const flipped =
                parsed.payload.at(-2) === 'A'
                    ? `${parsed.payload.slice(0, -2)}B${parsed.payload.at(-1)}`
                    : `${parsed.payload.slice(0, -2)}A${parsed.payload.at(-1)}`

            await expect(
                decryptBackupSyncQr(
                    JSON.stringify({ ...parsed, payload: flipped }),
                    CODE,
                ),
            ).rejects.toBeInstanceOf(BackupSyncQrError)
        })

        test('rejects a re-labelled envelope without ever deriving', async () => {
            const parsed = JSON.parse(envelope)
            argon2Mock.mockClear()

            const rejects = expect(
                decryptBackupSyncQr(
                    JSON.stringify({ ...parsed, t: 'backup-restore-helper' }),
                    CODE,
                ),
            ).rejects

            await rejects.toBeInstanceOf(BackupSyncQrError)
            await rejects.toThrowError('Not a sync QR payload')
            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('names an unsupported version instead of blaming the code', async () => {
            const parsed = JSON.parse(envelope)
            argon2Mock.mockClear()

            const error = await decryptBackupSyncQr(
                JSON.stringify({ ...parsed, v: 2 }),
                CODE,
            ).catch((thrown: unknown) => thrown)

            expect(error).toBeInstanceOf(BackupSyncQrUnsupportedVersionError)
            expect((error as BackupSyncQrUnsupportedVersionError).version).toBe(
                2,
            )
            // Before the derive, so a v2 QR fails in a blink instead of after a
            // 256 MiB pass that then reports a wrong code.
            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('rejects a malformed envelope', async () => {
            await expect(
                decryptBackupSyncQr('not json', CODE),
            ).rejects.toBeInstanceOf(BackupSyncQrError)
        })

        test('uses a fresh kdf salt per call', async () => {
            const second = await seal()

            expect(JSON.parse(second).kdf.salt).not.toBe(
                JSON.parse(envelope).kdf.salt,
            )
            expect(JSON.parse(second).payload).not.toBe(
                JSON.parse(envelope).payload,
            )
        })

        test('refuses an absurd memory cost without ever deriving', async () => {
            const parsed = JSON.parse(envelope)
            argon2Mock.mockClear()

            await expect(
                decryptBackupSyncQr(
                    JSON.stringify({
                        ...parsed,
                        // 4 TiB, straight off a scanned QR.
                        kdf: { ...parsed.kdf, memory_cost: 4_194_304 },
                    }),
                    CODE,
                ),
            ).rejects.toThrowError(
                'Sync QR asks for an unreasonable derivation',
            )

            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('refuses an inner kdf config the scanner would choke on', async () => {
            await expect(
                decryptBackupSyncQr(
                    resealWith(envelope, {
                        mnemonic: MNEMONIC,
                        salt: BACKUP_SALT,
                        // 4 TiB, for the master-key derive that follows.
                        argon2id: {
                            ...SERIALIZED_CONFIG,
                            memory_cost: 4_194_304,
                        },
                    }),
                    CODE,
                ),
            ).rejects.toThrowError(
                'Sync QR asks for an unreasonable derivation',
            )
        })

        test('refuses a non-integer kdf parameter without ever deriving', async () => {
            const parsed = JSON.parse(envelope)
            argon2Mock.mockClear()

            await expect(
                decryptBackupSyncQr(
                    JSON.stringify({
                        ...parsed,
                        kdf: { ...parsed.kdf, time_cost: -1 },
                    }),
                    CODE,
                ),
            ).rejects.toBeInstanceOf(BackupSyncQrError)

            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('rejects a version that is not a positive integer', async () => {
            const parsed = JSON.parse(envelope)

            for (const v of [0, -1, 1.5]) {
                argon2Mock.mockClear()

                const rejects = expect(
                    decryptBackupSyncQr(JSON.stringify({ ...parsed, v }), CODE),
                ).rejects

                await rejects.toThrowError('Not a sync QR payload')
                expect(argon2Mock).not.toHaveBeenCalled()
            }
        })

        test('refuses a kdf salt too short to derive under', async () => {
            const parsed = JSON.parse(envelope)
            argon2Mock.mockClear()

            await expect(
                decryptBackupSyncQr(
                    JSON.stringify({
                        ...parsed,
                        kdf: { ...parsed.kdf, salt: '' },
                    }),
                    CODE,
                ),
            ).rejects.toBeInstanceOf(BackupSyncQrError)

            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('reports an undecodable kdf salt as a bad payload', async () => {
            const parsed = JSON.parse(envelope)

            await expect(
                decryptBackupSyncQr(
                    JSON.stringify({
                        ...parsed,
                        kdf: { ...parsed.kdf, salt: '!!!' },
                    }),
                    CODE,
                ),
            ).rejects.toBeInstanceOf(BackupSyncQrError)
        })

        test('parses a valid envelope without deriving', () => {
            argon2Mock.mockClear()

            const parsed = parseBackupSyncQrEnvelope(envelope)

            expect(parsed.version).toBe(1)
            expect(typeof parsed.payload).toBe('string')
            expect(parsed.kdfSalt).toBeInstanceOf(Uint8Array)
            expect(parsed.kdfConfig).toEqual(ARGON2ID_CONFIG)
            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('rejects a foreign payload type', () => {
            const raw = JSON.stringify({
                ...JSON.parse(envelope),
                t: 'something-else',
            })
            argon2Mock.mockClear()

            expect(() => parseBackupSyncQrEnvelope(raw)).toThrow(
                BackupSyncQrError,
            )
            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('names an unsupported version', () => {
            const raw = JSON.stringify({ ...JSON.parse(envelope), v: 2 })
            argon2Mock.mockClear()

            expect(() => parseBackupSyncQrEnvelope(raw)).toThrow(
                BackupSyncQrUnsupportedVersionError,
            )
            expect(argon2Mock).not.toHaveBeenCalled()
        })

        test('rejects an undecodable kdf salt', () => {
            const raw = JSON.stringify({
                ...JSON.parse(envelope),
                kdf: { ...JSON.parse(envelope).kdf, salt: '!!!' },
            })

            expect(() => parseBackupSyncQrEnvelope(raw)).toThrow(
                BackupSyncQrError,
            )
        })

        test('rejects malformed input', () => {
            expect(() => parseBackupSyncQrEnvelope('not json')).toThrow(
                BackupSyncQrError,
            )
        })
    })
})
