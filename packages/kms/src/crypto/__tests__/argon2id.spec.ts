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

import { describe, expect, it, beforeEach, vi } from 'vitest'

type Argon2Params = {
    message: Uint8Array
    nonce: Uint8Array
    parallelism: number
    tagLength: number
    memory: number
    passes: number
}

type Argon2Callback = (error: Error | null, result: Uint8Array) => void

const { argon2Mock } = vi.hoisted(() => ({ argon2Mock: vi.fn() }))

// `crypto.argon2` landed in Node 24 and reaches production through
// react-native-quick-crypto, so standing something in its place is the only
// way to run this here.
vi.mock('crypto', async importOriginal => {
    const actual = await importOriginal<typeof import('crypto')>()
    return { ...actual, argon2: argon2Mock }
})

import { argon2idDerive } from '../argon2id'

const params = {
    timeCost: 3,
    memoryCost: 256,
    parallelism: 1,
    outputLength: 32,
}

const message = new TextEncoder().encode('password')
const nonce = new Uint8Array(16).fill(1)

beforeEach(() => {
    argon2Mock.mockReset()
})

describe('argon2idDerive', () => {
    it('converts the MiB memory cost to the KiB the primitive takes', async () => {
        argon2Mock.mockImplementation(
            (_algorithm: string, _params: Argon2Params, cb: Argon2Callback) =>
                cb(null, new Uint8Array(32)),
        )

        await argon2idDerive(message, nonce, params)

        const [algorithm, passed] = argon2Mock.mock.calls[0] as [
            string,
            Argon2Params,
        ]
        expect(algorithm).toBe('argon2id')
        expect(passed.memory).toBe(256 * 1024)
        expect(passed.passes).toBe(3)
        expect(passed.parallelism).toBe(1)
        expect(passed.tagLength).toBe(32)
        expect(passed.message).toBe(message)
        expect(passed.nonce).toBe(nonce)
    })

    it('resolves the derived bytes', async () => {
        const derived = new Uint8Array(32).fill(5)
        argon2Mock.mockImplementation(
            (_algorithm: string, _params: Argon2Params, cb: Argon2Callback) =>
                cb(null, derived),
        )

        await expect(argon2idDerive(message, nonce, params)).resolves.toEqual(
            derived,
        )
    })

    it('rejects when the primitive reports an error', async () => {
        argon2Mock.mockImplementation(
            (_algorithm: string, _params: Argon2Params, cb: Argon2Callback) =>
                cb(new Error('argon2 failed'), new Uint8Array()),
        )

        await expect(argon2idDerive(message, nonce, params)).rejects.toThrow(
            'argon2 failed',
        )
    })
})
