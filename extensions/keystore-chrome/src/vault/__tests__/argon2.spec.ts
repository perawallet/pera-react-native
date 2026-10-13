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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { argon2id } from '@noble/hashes/argon2.js'
import {
    ARGON2_WORKER_URL,
    computeArgon2id,
    deriveArgon2id,
    type Argon2Request,
} from '../argon2'

// Cheap parameters: these tests are about the plumbing, not the cost.
const PARAMS = { m: 64, t: 1, p: 1 }
const SALT = new Uint8Array(16).fill(2)

const request = (): Argon2Request => ({
    password: new TextEncoder().encode('hunter22'),
    salt: SALT,
    ...PARAMS,
})

const expectedKey = (): Uint8Array =>
    argon2id(new TextEncoder().encode('hunter22'), SALT, {
        ...PARAMS,
        dkLen: 32,
    })

type FakeWorker = {
    url: string
    posted: Argon2Request | null
    terminated: boolean
    onmessage: ((event: { data: Uint8Array }) => void) | null
    onerror: ((event: { message: string }) => void) | null
    postMessage: (message: Argon2Request) => void
    terminate: () => void
}

const stubWorker = (reply: (worker: FakeWorker) => void): FakeWorker[] => {
    const created: FakeWorker[] = []
    vi.stubGlobal(
        'Worker',
        class {
            constructor(url: string) {
                const worker: FakeWorker = {
                    url,
                    posted: null,
                    terminated: false,
                    onmessage: null,
                    onerror: null,
                    postMessage: message => {
                        worker.posted = message
                        queueMicrotask(() => reply(worker))
                    },
                    terminate: () => {
                        worker.terminated = true
                    },
                }
                created.push(worker)
                return worker
            }
        },
    )
    return created
}

describe('argon2', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('computes Argon2id and zeroes the password', () => {
        const input = request()

        expect(computeArgon2id(input)).toEqual(expectedKey())
        expect(input.password.every(byte => byte === 0)).toBe(true)
    })

    it('derives in-thread where there is no Worker', async () => {
        expect(await deriveArgon2id(request())).toEqual(expectedKey())
    })

    it('derives in a one-shot worker and zeroes the page copy', async () => {
        const workers = stubWorker(worker =>
            worker.onmessage?.({ data: computeArgon2id(worker.posted!) }),
        )
        const input = request()

        const key = await deriveArgon2id(input)

        expect(key).toEqual(expectedKey())
        expect(workers).toHaveLength(1)
        expect(workers[0].url).toBe(ARGON2_WORKER_URL)
        expect(workers[0].terminated).toBe(true)
        expect(input.password.every(byte => byte === 0)).toBe(true)
    })

    it('falls back in-thread with the real password when the worker fails', async () => {
        const workers = stubWorker(worker =>
            worker.onerror?.({ message: 'failed to load' }),
        )

        expect(await deriveArgon2id(request())).toEqual(expectedKey())
        expect(workers[0].terminated).toBe(true)
    })
})
