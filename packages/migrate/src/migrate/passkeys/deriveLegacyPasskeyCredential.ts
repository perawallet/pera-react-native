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

import { DeterministicP256 } from '@algorandfoundation/dp256'
import { sha256 } from '@noble/hashes/sha2'
import { deriveLiquidAuthMainKey } from '@perawallet/wallet-core-kms'
import {
    decodeFromBase64,
    encodeToBase64,
    hexToBytes,
} from '@perawallet/wallet-core-shared'

/**
 * Pure-JS reproduction of a legacy passkey's deterministic P-256 keypair.
 *
 * A passkey is never a transferred secret — the legacy apps (pera-ios
 * `PassKeyService.dp256KeyPair`, pera-android `DeterministicBip39SignManager`)
 * register it with the relying party by *re-deriving* it from the owning HD
 * wallet through the `DeterministicP256` (Liquid Auth) contract:
 *
 *   1. `derivedMainKey = genDerivedMainKeyWithBIP39(mnemonic)`
 *        — PBKDF2-HMAC-SHA512, salt "liquid", 210k iterations, 64 bytes.
 *   2. `privateKey = genDomainSpecificKeyPair(derivedMainKey, origin, userName)`
 *        — `userName` is the WebAuthn `user.name`, used verbatim (NOT lowercased;
 *          the native RN module lowercases it, legacy does not — we match legacy).
 *   3. `credentialId = SHA256(publicKey)` — Android hashes the SPKI DER encoding,
 *        iOS the raw 64-byte point (see {@link PasskeyCredentialIdBasis}).
 *
 * For a migrated passkey to *sign in* (rather than re-register), the keystore
 * must hold this exact keypair under this exact `credentialId`. We reproduce it
 * here and the caller verifies the recomputed `credentialId` against the legacy
 * one before persisting — a mismatch means the derivation inputs don't line up,
 * so we skip rather than write an unsignable credential.
 */

const dp256 = new DeterministicP256()

/**
 * Fixed P-256 SubjectPublicKeyInfo (X.509) DER prefix, up to and including the
 * BIT STRING header (`03 42 00`). A full uncompressed-point SPKI is this 26-byte
 * prefix, followed by the `0x04` uncompressed-point indicator and the 64-byte
 * `X || Y` coordinates — 91 bytes total. `dp256.getPurePKBytes` returns the raw
 * 64-byte `X || Y` (no `0x04`), so we splice the indicator back in.
 */
const P256_SPKI_PREFIX = Uint8Array.from([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
])

/**
 * Wraps the raw 64-byte (`X || Y`) P-256 public key in X.509/SPKI DER, matching
 * `KeyPair.public.encoded` on the native side. The native provider's
 * `getKeyPairFromCredential` reconstructs the key from this DER (its happy path),
 * and `generateCredentialId` hashes exactly these bytes.
 */
export const p256RawPublicKeyToSpkiDer = (pubRaw: Uint8Array): Uint8Array => {
    const der = new Uint8Array(P256_SPKI_PREFIX.length + 1 + pubRaw.length)
    der.set(P256_SPKI_PREFIX, 0)
    der[P256_SPKI_PREFIX.length] = 0x04
    der.set(pubRaw, P256_SPKI_PREFIX.length + 1)
    return der
}

/**
 * Decodes a credentialId string to its raw 32-byte SHA-256 digest. Accepts the
 * standard-base64 form the legacy migration data carries, plus url-safe base64
 * and lowercase hex as defensive fallbacks (the legacy DB has been observed in
 * more than one encoding across platforms). Returns null when it doesn't decode
 * to a plausible 32-byte digest.
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

/**
 * Derives the BIP39 "derived main key" via `deriveLiquidAuthMainKey`. PBKDF2 is
 * heavy, so callers cache the result per HD seed and reuse it across that seed's
 * passkeys.
 */
export const deriveMainKey = (mnemonic: string): Promise<Uint8Array> =>
    deriveLiquidAuthMainKey(mnemonic)

/**
 * Which encoding of the P-256 public key the legacy platform hashed to form the
 * `credentialId`. Same keypair, different digest:
 *   • `'spki-der'` — Android: SHA256 of the 91-byte X.509/SPKI DER.
 *   • `'raw-point'` — iOS: SHA256 of the raw 64-byte point `X || Y`
 *     (CryptoKit `publicKey.rawRepresentation`).
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

/**
 * Reproduces a single passkey's keypair + credentialId from an already-derived
 * main key. Split from {@link deriveMainKey} so the expensive PBKDF2 step is
 * shared across every passkey owned by the same HD seed.
 */
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
