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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 encoding.ts
// Portions Copyright Algorand Foundation, Apache-2.0

import { sha512_256 } from '@noble/hashes/sha2.js'
import { base32 } from '@scure/base'

export function encodeAddress(publicKey: Uint8Array<ArrayBufferLike>): string {
    const hash = sha512_256(publicKey) // 32 bytes
    const checksum = hash.slice(-4) // last 4 bytes
    const addressBytes = new Uint8Array([...publicKey, ...checksum])
    return base32.encode(addressBytes).replace(/=+$/, '').toUpperCase()
}
