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

import { argon2id } from '@noble/hashes/argon2.js'

export type Argon2Params = { m: number; t: number; p: number }

export type Argon2Request = Argon2Params & {
    password: Uint8Array
    salt: Uint8Array
}

/**
 * Served next to the extension pages by apps/browser/scripts/build.mjs, which
 * bundles argon2-worker.ts to this name.
 */
export const ARGON2_WORKER_URL = 'argon2-worker.js'

/** Zeroes `request.password` once the key is derived. */
export const computeArgon2id = (request: Argon2Request): Uint8Array => {
    try {
        return argon2id(request.password, request.salt, {
            m: request.m,
            t: request.t,
            p: request.p,
            dkLen: 32,
        })
    } finally {
        request.password.fill(0)
    }
}

const deriveInWorker = (request: Argon2Request): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        const worker = new Worker(ARGON2_WORKER_URL, { type: 'module' })
        const finish = (): void => worker.terminate()
        worker.onmessage = (event: MessageEvent<Uint8Array>) => {
            finish()
            resolve(event.data)
        }
        worker.onerror = event => {
            finish()
            reject(new Error(event.message || 'argon2 worker failed'))
        }
        // Cloned, not transferred: the fallback below still needs the bytes.
        worker.postMessage(request)
    })

/**
 * Derives a 32-byte Argon2id key off the main thread where the context allows
 * a Worker, so the popup keeps painting through a derivation that takes most
 * of a second. Zeroes `request.password` either way.
 */
export const deriveArgon2id = async (
    request: Argon2Request,
): Promise<Uint8Array> => {
    if (typeof Worker === 'undefined') return computeArgon2id(request)
    try {
        const key = await deriveInWorker(request)
        request.password.fill(0)
        return key
    } catch {
        // A worker that can't start (say the file is missing) must not make
        // the vault unopenable: falling back costs frozen frames, not the unlock.
        return computeArgon2id(request)
    }
}
