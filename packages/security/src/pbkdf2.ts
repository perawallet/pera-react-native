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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { pbkdf2 } from 'crypto'

const encoder = new TextEncoder()

// Zeros the UTF-8 encoded PIN buffer once pbkdf2 has consumed it. The PIN
// string itself is immutable (JS strings can't be wiped) — clearing the
// encoded byte view is the best we can do without a string-zeroing
// primitive.
export const pbkdf2Hash = (
    pin: string,
    salt: Uint8Array,
    iterations: number,
    keyLength: number,
    digest: string,
): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        const pinBytes = encoder.encode(pin)
        pbkdf2(
            pinBytes,
            salt,
            iterations,
            keyLength,
            digest,
            (err, derivedKey) => {
                zeroBytes(pinBytes)
                if (err || !derivedKey) {
                    reject(err ?? new Error('pbkdf2 returned no key'))
                    return
                }
                const hash = new Uint8Array(derivedKey)
                zeroBytes(derivedKey)
                resolve(hash)
            },
        )
    })
