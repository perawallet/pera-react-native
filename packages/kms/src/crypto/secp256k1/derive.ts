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

import { HDKey } from '@scure/bip32'
import type { Optional } from '@perawallet/wallet-core-shared'
import { KeyManagementError } from '../../errors'
import { zeroBytes } from '../secure-memory'

const HARDENED_OFFSET = 2 ** 31
const PATH_SEGMENT = /^(\d+)(')?$/

/** Child indices along `path`, hardened ones offset by 2^31. Throws on a malformed path. */
export const parseBip32Path = (path: string): number[] => {
    const [root, ...segments] = path.split('/')
    if (root !== 'm') {
        throw new KeyManagementError('A BIP-32 path starts with "m"')
    }
    return segments.map(segment => {
        const match = PATH_SEGMENT.exec(segment)
        const index = match ? Number(match[1]) : NaN
        if (!Number.isSafeInteger(index) || index >= HARDENED_OFFSET) {
            throw new KeyManagementError('Invalid BIP-32 path segment')
        }
        return match?.[2] ? index + HARDENED_OFFSET : index
    })
}

/**
 * The BIP-32 child private key at `path` (`m/…`, `'` for hardened) under a
 * 64-byte BIP-39 seed. The caller zeroes the result.
 *
 * Walks the path one node at a time rather than through `HDKey.derive`, which
 * leaves every intermediate node's private key unwiped, including the
 * account-level key that reaches every sibling address.
 */
export const deriveSecp256k1PrivateKey = (
    seed: Uint8Array,
    path: string,
): Uint8Array => {
    const indices = parseBip32Path(path)
    let node: Optional<HDKey>
    let nodeKey: Optional<Uint8Array>
    try {
        node = HDKey.fromMasterSeed(seed)
        for (const index of indices) {
            const child: HDKey = node.deriveChild(index)
            node.wipePrivateData()
            node = child
        }
        // Whether the getter returns the node's own buffer or a copy differs
        // between releases, so return a fresh copy and zero what it gave.
        nodeKey = node.privateKey ?? undefined
        if (!nodeKey) {
            throw new KeyManagementError('Derived node has no private key')
        }
        return Uint8Array.from(nodeKey)
    } finally {
        zeroBytes(nodeKey)
        node?.wipePrivateData()
    }
}
