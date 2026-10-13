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

import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { bytesToHex } from '@perawallet/wallet-core-shared'

/** Lowercase hex, 64 chars. The manifest is a case-sensitive record, so the
 *  casing is part of the identifier, not a formatting choice. */
export type ItemKeyHash = string & { readonly __itemKeyHash: unique symbol }

export type ItemKeyHasher = (address: string) => ItemKeyHash

export type DisposableItemKeyHasher = ItemKeyHasher & { dispose: () => void }

export class ItemKeyHasherDisposedError extends Error {
    constructor() {
        super('Item key hasher used after dispose')
        this.name = 'ItemKeyHasherDisposedError'
    }
}

const encoder = new TextEncoder()

export const hashItemAddress = (
    address: string,
    itemKey: Uint8Array,
): ItemKeyHash =>
    bytesToHex(hmac(sha256, itemKey, encoder.encode(address))) as ItemKeyHash

/** Owns a copy, so the hasher outlives the keystore scope zeroing the buffer it
 *  lent. Hashing after `dispose` throws rather than falling back to the zeroed
 *  copy: `HMAC(0^32, address)` is the same function for every wallet, so such a
 *  key would collide across backups and invert by dictionary. */
export const createItemKeyHasher = (
    itemKey: Uint8Array,
): DisposableItemKeyHasher => {
    const owned = new Uint8Array(itemKey)
    let isDisposed = false
    return Object.assign(
        (address: string) => {
            if (isDisposed) throw new ItemKeyHasherDisposedError()
            return hashItemAddress(address, owned)
        },
        {
            dispose: () => {
                isDisposed = true
                zeroBytes(owned)
            },
        },
    )
}

export const withItemKeyHasher = async <T>(
    itemKey: Uint8Array,
    run: (hashAddress: ItemKeyHasher) => Promise<T>,
): Promise<T> => {
    const hashAddress = createItemKeyHasher(itemKey)
    try {
        return await run(hashAddress)
    } finally {
        hashAddress.dispose()
    }
}
