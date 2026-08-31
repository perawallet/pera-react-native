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

import { createHash } from 'node:crypto'

export * from 'node:crypto'
export { default } from 'node:crypto'

type Argon2Params = {
    message: Uint8Array
    nonce: Uint8Array
    tagLength: number
}

/**
 * `crypto.argon2` arrived in Node 24 and reaches the app through
 * react-native-quick-crypto. The integration suite runs on neither, so the
 * cloud-backup KDF would throw before a flow test could reach the network.
 * This stands in with a deterministic SHA-256 stream: same inputs, same output,
 * so derived ids stay stable within a run — it is NOT Argon2 and proves nothing
 * about the real KDF, which `packages/backup` unit-tests directly.
 */
export const argon2 = (
    _algorithm: string,
    params: Argon2Params,
    callback: (error: Error | null, result: Buffer) => void,
): void => {
    let derived = Buffer.alloc(0)
    let block = Buffer.from(params.nonce)
    while (derived.length < params.tagLength) {
        block = createHash('sha256')
            .update(block)
            .update(params.message)
            .digest()
        derived = Buffer.concat([derived, block])
    }
    callback(null, derived.subarray(0, params.tagLength))
}
