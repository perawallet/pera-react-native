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

import { argon2 } from 'crypto'
import { ARGON2ID_CONFIG } from './constants'

const KIB_PER_MIB = 1024

/**
 * Derives the backup master key (`K_master`) via Argon2id from the
 * mnemonic-derived password and the setup salt. This is the root of the cloud
 * backup key hierarchy and is unrelated to the wallet's HD root seed; it exists
 * only to derive the backup child keys and is never persisted.
 */
export const deriveBackupMasterKey = (
    password: Uint8Array,
    salt: Uint8Array,
): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        argon2(
            'argon2id',
            {
                message: password,
                nonce: salt,
                parallelism: ARGON2ID_CONFIG.parallelism,
                tagLength: ARGON2ID_CONFIG.outputLength,
                memory: ARGON2ID_CONFIG.memoryCost * KIB_PER_MIB,
                passes: ARGON2ID_CONFIG.timeCost,
            },
            (error, result) => {
                if (error) reject(error)
                else resolve(new Uint8Array(result))
            },
        )
    })
