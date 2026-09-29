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

import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'

export type Argon2Algorithm = 'argon2d' | 'argon2i' | 'argon2id'

export type Argon2Params = {
    message: Uint8Array
    nonce: Uint8Array
    parallelism: number
    tagLength: number
    memory: number
    passes: number
}

type Argon2Callback = (error: Error | null, result: Uint8Array) => void

const WORKER_PATH = fileURLToPath(
    new URL('./argon2.worker.mjs', import.meta.url).href,
)

/**
 * Pure-JS Argon2id at 256 MiB, run on a worker thread. V8 coverage is
 * per-isolate, so the worker runs uninstrumented: on the calling thread a
 * `--coverage` run on a loaded machine stretches one derive past a minute.
 */
export const argon2OffThread = (
    algorithm: Argon2Algorithm,
    params: Argon2Params,
    callback: Argon2Callback,
): void => {
    const worker = new Worker(WORKER_PATH, {
        workerData: {
            algorithm,
            message: params.message,
            nonce: params.nonce,
            options: {
                t: params.passes,
                m: params.memory,
                p: params.parallelism,
                dkLen: params.tagLength,
            },
        },
    })
    worker.once('message', (result: Uint8Array) => {
        void worker.terminate()
        callback(null, new Uint8Array(result))
    })
    worker.once('error', error => callback(error, new Uint8Array()))
}
