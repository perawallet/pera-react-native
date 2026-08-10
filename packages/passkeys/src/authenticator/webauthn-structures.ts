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

import { sha256 } from '@noble/hashes/sha2'
import { concatBytes } from '@perawallet/wallet-core-shared'
import {
    encodeCborBytes,
    encodeCborInt,
    encodeCborMap,
    encodeCborText,
} from './cbor'

/**
 * WebAuthn attestation-object assembly, byte-for-byte port of the private
 * `WebAuthn` enum in `PasskeyAutofillCredentialProvider/WebAuthn.swift`. Any
 * change here must stay in lockstep with that file — iOS, Android, and this
 * extension authenticator must all produce identical attestation bytes for
 * the same inputs.
 */

/** Default authenticator AAGUID (`1F59713A-C021-4E63-9158-2CC5FDC14E52`), raw 16 bytes in UUID field order. */
export const AAGUID: Uint8Array = Uint8Array.from([
    0x1f, 0x59, 0x71, 0x3a, 0xc0, 0x21, 0x4e, 0x63, 0x91, 0x58, 0x2c, 0xc5,
    0xfd, 0xc1, 0x4e, 0x52,
])

// Authenticator-data flag bits (WebAuthn L3 §6.1).
const FLAG_UP = 0x01 // user present
const FLAG_UV = 0x04 // user VERIFIED — a second factor was actually checked
const FLAG_BE = 0x08 // backup eligible
const FLAG_BS = 0x10 // backup state
const FLAG_AT = 0x40 // attested credential data included

// UP|BE|BS. UV is added per-ceremony, never baked in — see `userVerified`.
const FLAGS_BASE = FLAG_UP | FLAG_BE | FLAG_BS

const SIGN_COUNT = Uint8Array.from([0x00, 0x00, 0x00, 0x00])

export type P256PublicKeyXY = {
    x: Uint8Array
    y: Uint8Array
}

/** Encodes a P-256 COSE key as CBOR: `{1:2, 3:-7, -1:1, -2:x, -3:y}`, pairs in that exact order. */
export const coseKeyP256 = (x: Uint8Array, y: Uint8Array): Uint8Array =>
    encodeCborMap([
        [encodeCborInt(1), encodeCborInt(2)],
        [encodeCborInt(3), encodeCborInt(-7)],
        [encodeCborInt(-1), encodeCborInt(1)],
        [encodeCborInt(-2), encodeCborBytes(x)],
        [encodeCborInt(-3), encodeCborBytes(y)],
    ])

/** Assembles `attestedCredentialData`: AAGUID(16) || credIdLen(2, BE) || credentialId || COSEkey. */
export const attestedCredentialData = (
    credentialId: Uint8Array,
    publicKeyXY: P256PublicKeyXY,
): Uint8Array => {
    const credIdLen = Uint8Array.from([
        (credentialId.length >> 8) & 0xff,
        credentialId.length & 0xff,
    ])
    return concatBytes(
        AAGUID,
        credIdLen,
        credentialId,
        coseKeyP256(publicKeyXY.x, publicKeyXY.y),
    )
}

export type AuthenticatorDataParams = {
    rpId: string
    attested: boolean
    credentialId?: Uint8Array
    publicKeyXY?: P256PublicKeyXY
    /**
     * Whether this ceremony actually verified the user (a password, PIN, or
     * biometric checked at ceremony time) — NOT merely that they clicked
     * approve.
     *
     * Relying parties configured `userVerification: 'required'` treat the UV
     * bit as proof a human authenticated with a factor just now, and use it to
     * gate passwordless sign-in and high-value step-up. On iOS/Android this
     * bit is truthful because the OS gates the credential-provider ceremony
     * behind Face ID; the extension has no such guarantee, so the caller must
     * state it. Defaults to `false`: a caller that forgets understates its
     * assurance rather than overstating it.
     */
    userVerified?: boolean
}

/**
 * Assembles `authenticatorData`: SHA256(rpId) || flags || signCount(4 zero
 * bytes) [|| attestedCredentialData].
 *
 * Flags are UP|BE|BS, plus AT when attested data is included, plus UV when —
 * and only when — the ceremony verified the user.
 */
export const authenticatorData = async ({
    rpId,
    attested,
    credentialId,
    publicKeyXY,
    userVerified = false,
}: AuthenticatorDataParams): Promise<Uint8Array> => {
    const rpIdHash = sha256(new TextEncoder().encode(rpId))
    const flags = Uint8Array.from([
        FLAGS_BASE | (attested ? FLAG_AT : 0) | (userVerified ? FLAG_UV : 0),
    ])

    if (!attested) {
        return concatBytes(rpIdHash, flags, SIGN_COUNT)
    }

    if (!credentialId || !publicKeyXY) {
        throw new Error(
            'authenticatorData: credentialId and publicKeyXY are required when attested is true',
        )
    }

    return concatBytes(
        rpIdHash,
        flags,
        SIGN_COUNT,
        attestedCredentialData(credentialId, publicKeyXY),
    )
}

/** Wraps `authData` in the CBOR "none" attestation object: `{"fmt":"none","attStmt":{},"authData":<bytes>}`. */
export const attestationObjectNone = (authData: Uint8Array): Uint8Array =>
    encodeCborMap([
        [encodeCborText('fmt'), encodeCborText('none')],
        [encodeCborText('attStmt'), encodeCborMap([])],
        [encodeCborText('authData'), encodeCborBytes(authData)],
    ])

/**
 * Splits a P-256 public key into its 32-byte X/Y coordinates. Accepts a raw
 * 64-byte `X || Y` point or a 65-byte `0x04`-prefixed uncompressed point
 * (the `0x04` prefix is dropped).
 */
export const splitP256PublicKey = (publicKey: Uint8Array): P256PublicKeyXY => {
    if (publicKey.length === 65 && publicKey[0] === 0x04) {
        return {
            x: publicKey.slice(1, 33),
            y: publicKey.slice(33, 65),
        }
    }
    if (publicKey.length === 64) {
        return {
            x: publicKey.slice(0, 32),
            y: publicKey.slice(32, 64),
        }
    }
    throw new Error(`Invalid P-256 public key length: ${publicKey.length}`)
}
