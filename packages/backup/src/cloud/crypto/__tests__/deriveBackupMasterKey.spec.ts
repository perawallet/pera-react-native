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

const { argon2Mock } = vi.hoisted(() => ({ argon2Mock: vi.fn() }))

vi.mock('crypto', async importOriginal => {
    const actual = await importOriginal<typeof import('crypto')>()
    return { ...actual, argon2: argon2Mock }
})

import { deriveBackupMasterKey } from '../deriveBackupMasterKey'

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
})
