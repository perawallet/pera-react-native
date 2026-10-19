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

import * as nodeCrypto from 'node:crypto'

export * from 'node:crypto'
export { default } from 'node:crypto'

type Argon2Params = {
    message: Uint8Array
    nonce: Uint8Array
    tagLength: number
}

type Argon2Fn = (
    algorithm: string,
    params: Argon2Params,
    callback: (error: Error | null, result: Buffer) => void,
) => void

/**
 * A deterministic SHA-256 stream in place of Argon2: same inputs, same output,
 * so derived ids stay stable within a run. It is NOT Argon2 and proves nothing
 * about the KDF itself; the backup package's reference-vector spec pins that.
 * Flow tests use it even on Node 24+, where the real one exists, because the
 * production cost (256 MiB, 3 passes per derivation) made the cloud-backup
 * flows the slowest specs in the suite and timed them out under load.
 */
const standInArgon2: Argon2Fn = (_algorithm, params, callback) => {
    let derived = Buffer.alloc(0)
    let block = Buffer.from(params.nonce)
    while (derived.length < params.tagLength) {
        block = nodeCrypto
            .createHash('sha256')
            .update(block)
            .update(params.message)
            .digest()
        derived = Buffer.concat([derived, block])
    }
    // Async like the real primitive, so flows still render their pending state.
    setImmediate(() => callback(null, derived.subarray(0, params.tagLength)))
}

// Shadows the star export above, which would otherwise expose Node's own.
export const argon2: Argon2Fn = standInArgon2
