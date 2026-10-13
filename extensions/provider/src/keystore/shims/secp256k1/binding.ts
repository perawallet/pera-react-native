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

import * as secp from '@noble/secp256k1'
import { HDKey } from '@scure/bip32'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { InvalidKeyDataError } from '@algorandfoundation/keystore-core'

// The synchronous API needs these. Hermes has no WebCrypto, so the async
// variants that fall back to it are not an option on device.
secp.hashes.sha256 = sha256
secp.hashes.hmacSha256 = (key, message) => hmac(sha256, key, message)

const SCALAR_LENGTH = 32
const HARDENED_OFFSET = 2 ** 31
const PATH_SEGMENT = /^(\d+)(')?$/

/** The key operations the secp256k1 shim needs, injected so platforms can swap the library. */
export type Secp256k1Binding = {
    /** BIP-32 child private key at `path` under a 64-byte seed. Caller zeroes it. */
    deriveChildPrivateKey(seed: Uint8Array, path: string): Uint8Array
    /** 65-byte uncompressed SEC1 point (`0x04‖X‖Y`). */
    publicKeyOf(privateKey: Uint8Array): Uint8Array
    /** `r‖s‖yParity` over a 32-byte digest. */
    signDigest(privateKey: Uint8Array, digest: Uint8Array): Uint8Array
    /** 32 bytes encoding a scalar in `[1, n-1]`. */
    isValidPrivateKey(privateKey: Uint8Array): boolean
}

/** Child indices along `path`, hardened ones offset by 2^31. Throws on a malformed path. */
export const parseBip32Path = (path: string): number[] => {
    const [root, ...segments] = path.split('/')
    if (root !== 'm') {
        throw new InvalidKeyDataError('a BIP-32 path starts with "m"')
    }
    return segments.map(segment => {
        const match = PATH_SEGMENT.exec(segment)
        const index = match ? Number(match[1]) : NaN
        if (!Number.isSafeInteger(index) || index >= HARDENED_OFFSET) {
            throw new InvalidKeyDataError(
                `invalid BIP-32 path segment: ${segment}`,
            )
        }
        return match?.[2] ? index + HARDENED_OFFSET : index
    })
}

/**
 * Walks the path one node at a time rather than through `HDKey.derive`, which
 * leaves every intermediate node's private key unwiped, including the
 * account-level key that reaches every sibling address.
 */
export const deriveSecp256k1PrivateKey = (
    seed: Uint8Array,
    path: string,
): Uint8Array => {
    const indices = parseBip32Path(path)
    let node: HDKey | undefined
    let nodeKey: Uint8Array | undefined
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
            throw new InvalidKeyDataError('derived node has no private key')
        }
        return Uint8Array.from(nodeKey)
    } finally {
        nodeKey?.fill(0)
        node?.wipePrivateData()
    }
}

/**
 * RFC 6979 ECDSA over `digest` exactly as given (`prehash: false`), low-s, as
 * `r‖s‖yParity`: the layout Ethereum serialises, with `yParity` raw (0/1).
 */
export const signSecp256k1Recoverable = (
    privateKey: Uint8Array,
    digest: Uint8Array,
): Uint8Array => {
    // `recovered` is `recovery‖r‖s`.
    const recovered = secp.sign(digest, privateKey, {
        prehash: false,
        lowS: true,
        format: 'recovered',
    })
    const recovery = recovered[0]
    // 2 and 3 flag an R whose x overflowed the order; vanishingly rare, but
    // folding them to 0 would hand back a signature that recovers wrongly.
    if (recovery !== 0 && recovery !== 1) {
        throw new InvalidKeyDataError('unexpected secp256k1 recovery id')
    }
    const out = new Uint8Array(2 * SCALAR_LENGTH + 1)
    out.set(recovered.subarray(1), 0)
    out[2 * SCALAR_LENGTH] = recovery
    return out
}

export const secp256k1Binding: Secp256k1Binding = {
    deriveChildPrivateKey: deriveSecp256k1PrivateKey,
    publicKeyOf: privateKey => secp.getPublicKey(privateKey, false),
    signDigest: signSecp256k1Recoverable,
    isValidPrivateKey: privateKey =>
        privateKey.length === SCALAR_LENGTH &&
        secp.utils.isValidSecretKey(privateKey),
}
