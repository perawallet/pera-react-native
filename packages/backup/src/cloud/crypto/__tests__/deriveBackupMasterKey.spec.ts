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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { argon2d, argon2i, argon2id } from '@noble/hashes/argon2.js'
import { bytesToHex } from '@perawallet/wallet-core-shared'

const { argon2Mock } = vi.hoisted(() => ({ argon2Mock: vi.fn() }))

vi.mock('crypto', async importOriginal => {
    const actual = await importOriginal<typeof import('crypto')>()
    return { ...actual, argon2: argon2Mock }
})

import { deriveBackupMasterKey } from '../deriveBackupMasterKey'

type Argon2Algorithm = 'argon2d' | 'argon2i' | 'argon2id'

type Argon2Params = {
    message: Uint8Array
    nonce: Uint8Array
    parallelism: number
    tagLength: number
    memory: number
    passes: number
}

const ARGON2_BY_ALGORITHM = { argon2d, argon2i, argon2id }

/**
 * `crypto.argon2` landed in Node 24 and reaches production through
 * react-native-quick-crypto, so standing a conformant Argon2id in its place is
 * the only way to run the primitive here. Dispatching on the algorithm name
 * keeps the `'argon2id'` choice itself under test: argon2d would derive
 * different bytes and fail the vector below.
 */
const useRealArgon2 = () => {
    argon2Mock.mockImplementation(
        (
            algorithm: Argon2Algorithm,
            params: Argon2Params,
            callback: (error: Error | null, result: Uint8Array) => void,
        ) => {
            callback(
                null,
                ARGON2_BY_ALGORITHM[algorithm](params.message, params.nonce, {
                    t: params.passes,
                    m: params.memory,
                    p: params.parallelism,
                    dkLen: params.tagLength,
                }),
            )
        },
    )
}

/**
 * Cross-platform reference vector for `ARGON2ID_CONFIG`. Every platform
 * deriving a backup master key must reproduce it — if it moves, existing
 * backups stop restoring. Verified against OpenSSL 3.6 `kdf ARGON2ID`,
 * independently of the @noble implementation this file runs.
 *
 * THROWAWAY INPUTS — published in source, never used for a real backup.
 */
const KAT_PASSWORD = new TextEncoder().encode('pera-cloud-backup-kat')
const KAT_SALT = Uint8Array.from({ length: 16 }, (_, index) => index)
const KAT_MASTER_KEY =
    '21abf8fa4c9235ea8bd4374ba19d41a5cf2ee3b94f80c803a44b30d646c02506'

describe('deriveBackupMasterKey', () => {
    beforeEach(() => {
        argon2Mock.mockReset()
    })

    test('invokes argon2id with the canonical parameters and salt as nonce', async () => {
        const output = new Uint8Array(32).fill(7)
        argon2Mock.mockImplementation((_algorithm, _params, callback) => {
            callback(null, Buffer.from(output))
        })
        const password = new TextEncoder().encode('correct horse')
        const salt = new Uint8Array([1, 2, 3, 4])

        const result = await deriveBackupMasterKey(password, salt)

        expect(argon2Mock).toHaveBeenCalledWith(
            'argon2id',
            expect.objectContaining({
                message: password,
                nonce: salt,
                parallelism: 1,
                tagLength: 32,
                memory: 262_144,
                passes: 3,
            }),
            expect.any(Function),
        )
        expect(result).toEqual(output)
    })

    test('rejects when argon2 reports an error', async () => {
        argon2Mock.mockImplementation((_algorithm, _params, callback) => {
            callback(new Error('argon2 failed'), Buffer.alloc(0))
        })

        await expect(
            deriveBackupMasterKey(
                new TextEncoder().encode('pw'),
                new Uint8Array([9]),
            ),
        ).rejects.toThrow('argon2 failed')
    })

    // Pure-JS Argon2id at 256 MiB is seconds, not milliseconds — the timeout is
    // the machine allowance, not a hang guard.
    test('derives the reference key from a real Argon2id', async () => {
        useRealArgon2()

        const result = await deriveBackupMasterKey(KAT_PASSWORD, KAT_SALT)

        expect(bytesToHex(result)).toBe(KAT_MASTER_KEY)
    }, 60_000)
})
