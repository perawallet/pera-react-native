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

// Consumers that compile kms from source (conformance) have their own tsconfig
// `include`, which never picks up the sibling augmentation. Import it so it
// travels with the only file that needs it; the import erases at runtime.
import type {} from './crypto-argon2'
import { argon2 } from 'crypto'

export type Argon2idParams = {
    timeCost: number
    /** MiB. The primitive takes KiB, which this module converts. */
    memoryCost: number
    parallelism: number
    outputLength: number
}

const KIB_PER_MIB = 1024

export const argon2idDerive = (
    message: Uint8Array,
    nonce: Uint8Array,
    params: Argon2idParams,
): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        argon2(
            'argon2id',
            {
                message,
                nonce,
                parallelism: params.parallelism,
                tagLength: params.outputLength,
                memory: params.memoryCost * KIB_PER_MIB,
                passes: params.timeCost,
            },
            (error, result) => {
                if (error) reject(error)
                else resolve(new Uint8Array(result))
            },
        )
    })
