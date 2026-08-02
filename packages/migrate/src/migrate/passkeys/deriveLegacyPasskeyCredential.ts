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

import { DeterministicP256 } from '@algorandfoundation/dp256'
import { sha256 } from '@noble/hashes/sha2'
import { deriveLiquidAuthMainKey } from '@perawallet/wallet-core-kms'
import {
    decodeFromBase64,
    encodeToBase64,
    hexToBytes,
} from '@perawallet/wallet-core-shared'

/**
 * Pure-JS reproduction of a legacy passkey's deterministic P-256 keypair. A
 * passkey is never a transferred secret — the legacy apps re-derive it from the
 * owning HD wallet through the DeterministicP256 (Liquid Auth) contract:
 *
 *   1. `genDerivedMainKeyWithBIP39(mnemonic)` — PBKDF2-HMAC-SHA512, salt
 *      "liquid", 210k iterations, 64 bytes.
 *   2. `genDomainSpecificKeyPair(derivedMainKey, origin, userName)` — `userName`
 *      verbatim, NOT lowercased: the native RN module lowercases, legacy does
 *      not, and we match legacy.
 *   3. `SHA256(publicKey)` — over the SPKI DER on Android, the raw point on iOS
 *      (see {@link PasskeyCredentialIdBasis}).
 *
 * For a migrated passkey to sign in rather than re-register, the keystore must
 * hold this exact keypair under this exact credentialId — so the caller verifies
 * the recomputed id before persisting, and skips rather than writing an
 * unsignable credential.
 */

const dp256 = new DeterministicP256()

/**
 * P-256 SPKI DER prefix through the BIT STRING header. Full SPKI = this 26-byte
 * prefix + `0x04` + the 64-byte `X || Y` = 91 bytes. `getPurePKBytes` returns
 * the raw point without `0x04`, so the indicator is spliced back in.
 */
const P256_SPKI_PREFIX = Uint8Array.from([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
])

/**
 * Matches `KeyPair.public.encoded` on the native side — its
 * `getKeyPairFromCredential` reconstructs from this DER, and
 * `generateCredentialId` hashes exactly these bytes.
 */
export const p256RawPublicKeyToSpkiDer = (pubRaw: Uint8Array): Uint8Array => {
    const der = new Uint8Array(P256_SPKI_PREFIX.length + 1 + pubRaw.length)
    der.set(P256_SPKI_PREFIX, 0)
    der[P256_SPKI_PREFIX.length] = 0x04
    der.set(pubRaw, P256_SPKI_PREFIX.length + 1)
    return der
}

/**
 * Accepts standard base64 (what the migration data carries) plus url-safe base64
 * and hex — the legacy DB has been seen in more than one encoding across
 * platforms. Null when it doesn't decode to a plausible 32-byte digest.
 */
export const decodeCredentialIdToBytes = (raw: string): Uint8Array | null => {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return hexToBytes(raw)
    }
    let normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
    const remainder = normalized.length % 4
    if (remainder === 1) return null
    if (remainder === 2) normalized += '=='
    else if (remainder === 3) normalized += '='
    try {
        const bytes = decodeFromBase64(normalized)
        return bytes.length === 32 ? bytes : null
    } catch {
        return null
    }
}

/** Standard-base64 (with padding) — the exact MMKV key the native provider's
 * `getCredential` derives via `Base64.encodeToString(credentialId, DEFAULT)`. */
export const credentialIdBytesToStandardBase64 = (bytes: Uint8Array): string =>
    encodeToBase64(bytes)

/** PBKDF2 is heavy, so callers cache this per HD seed across its passkeys. */
export const deriveMainKey = (mnemonic: string): Promise<Uint8Array> =>
    deriveLiquidAuthMainKey(mnemonic)

/**
 * Which public-key encoding the legacy platform hashed for the `credentialId` —
 * same keypair, different digest. Android hashed the SPKI DER, iOS the raw point.
 */
export type PasskeyCredentialIdBasis = 'spki-der' | 'raw-point'

export type DerivedLegacyPasskeyCredential = {
    /** Standard-base64 SHA-256 of the SPKI DER — the keystore/MMKV credential id. */
    credentialId: string
    /** Raw SHA-256 digest, for byte-exact comparison against the legacy id. */
    credentialIdBytes: Uint8Array
    /** Raw 32-byte P-256 private scalar (native reconstructs the keypair from it). */
    privateKey: Uint8Array
    /** 91-byte X.509/SPKI DER public key. */
    publicKeySpkiDer: Uint8Array
}

/** Split from {@link deriveMainKey} so its PBKDF2 is shared across a seed. */
export const deriveLegacyPasskeyCredentialFromMainKey = async (params: {
    derivedMainKey: Uint8Array
    origin: string
    userName: string
    counter?: number
    credentialIdBasis?: PasskeyCredentialIdBasis
}): Promise<DerivedLegacyPasskeyCredential> => {
    const {
        derivedMainKey,
        origin,
        userName,
        counter = 0,
        credentialIdBasis = 'spki-der',
    } = params
    const privateKey = await dp256.genDomainSpecificKeyPair(
        derivedMainKey,
        origin,
        userName,
        counter,
    )
    const pubRaw = dp256.getPurePKBytes(privateKey)
    const publicKeySpkiDer = p256RawPublicKeyToSpkiDer(pubRaw)
    const credentialIdBytes = sha256(
        credentialIdBasis === 'raw-point' ? pubRaw : publicKeySpkiDer,
    )
    return {
        credentialId: credentialIdBytesToStandardBase64(credentialIdBytes),
        credentialIdBytes,
        privateKey,
        publicKeySpkiDer,
    }
}
