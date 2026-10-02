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

const SEQUENCE = 0x30
const INTEGER = 0x02
const OCTET_STRING = 0x04
const OBJECT_IDENTIFIER = 0x06

// 1.2.840.10045.2.1 (id-ecPublicKey) and 1.2.840.10045.3.1.7 (prime256v1).
const EC_PUBLIC_KEY_OID = [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]
const PRIME256V1_OID = [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]

const P256_SCALAR_LENGTH = 32

type Tlv = { tag: number; value: Uint8Array; end: number }

const readTlv = (bytes: Uint8Array, offset: number): Tlv | null => {
    if (offset + 2 > bytes.length) return null
    const tag = bytes[offset]!
    let length = bytes[offset + 1]!
    let start = offset + 2
    if (length & 0x80) {
        const count = length & 0x7f
        if (count === 0 || count > 2 || start + count > bytes.length) {
            return null
        }
        length = 0
        for (let i = 0; i < count; i++)
            length = (length << 8) | bytes[start + i]!
        start += count
    }
    const end = start + length
    if (end > bytes.length) return null
    return { tag, value: bytes.subarray(start, end), end }
}

const equals = (value: Uint8Array, expected: readonly number[]): boolean =>
    value.length === expected.length &&
    value.every((byte, index) => byte === expected[index])

/** `null` for anything but a P-256 key. Android's provider stores
 *  `PrivateKey.encoded` (PKCS#8); iOS and this app store the raw scalar. The
 *  result is a copy the caller owns. */
export const p256PrivateKeyFromPkcs8 = (der: Uint8Array): Uint8Array | null => {
    const outer = readTlv(der, 0)
    if (outer?.tag !== SEQUENCE || outer.end !== der.length) return null

    const version = readTlv(outer.value, 0)
    if (version?.tag !== INTEGER || !equals(version.value, [0x00])) return null

    const algorithm = readTlv(outer.value, version.end)
    if (algorithm?.tag !== SEQUENCE) return null
    const keyType = readTlv(algorithm.value, 0)
    const curve = keyType && readTlv(algorithm.value, keyType.end)
    if (
        keyType?.tag !== OBJECT_IDENTIFIER ||
        !equals(keyType.value, EC_PUBLIC_KEY_OID) ||
        curve?.tag !== OBJECT_IDENTIFIER ||
        !equals(curve.value, PRIME256V1_OID)
    ) {
        return null
    }

    const wrapped = readTlv(outer.value, algorithm.end)
    if (wrapped?.tag !== OCTET_STRING) return null

    // SEC 1 ECPrivateKey: SEQUENCE { INTEGER 1, OCTET STRING privateKey, ... }
    const ecPrivateKey = readTlv(wrapped.value, 0)
    if (ecPrivateKey?.tag !== SEQUENCE) return null
    const ecVersion = readTlv(ecPrivateKey.value, 0)
    if (ecVersion?.tag !== INTEGER || !equals(ecVersion.value, [0x01])) {
        return null
    }
    const scalar = readTlv(ecPrivateKey.value, ecVersion.end)
    if (
        scalar?.tag !== OCTET_STRING ||
        scalar.value.length !== P256_SCALAR_LENGTH
    ) {
        return null
    }
    return Uint8Array.from(scalar.value)
}
