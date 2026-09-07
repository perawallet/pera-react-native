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

import { argon2 } from 'crypto'
import type { Argon2idConfig } from '../models'

const KIB_PER_MIB = 1024

/** `config.memoryCost` is MiB; the primitive takes KiB. */
export const argon2idDerive = (
    message: Uint8Array,
    nonce: Uint8Array,
    config: Argon2idConfig,
): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        argon2(
            'argon2id',
            {
                message,
                nonce,
                parallelism: config.parallelism,
                tagLength: config.outputLength,
                memory: config.memoryCost * KIB_PER_MIB,
                passes: config.timeCost,
            },
            (error, result) => {
                if (error) reject(error)
                else resolve(new Uint8Array(result))
            },
        )
    })
