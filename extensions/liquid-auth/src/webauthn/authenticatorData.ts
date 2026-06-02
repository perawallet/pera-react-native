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

import { sha256 } from '@noble/hashes/sha256'

import { concatBytes } from '../encoding/bytes'

/** WebAuthn authenticator data flag bits. */
const FLAG_UP = 0x01 // user present
const FLAG_UV = 0x04 // user verified
const FLAG_AT = 0x40 // attested credential data included

export type AttestedCredentialData = {
    /** 16-byte authenticator AAGUID. */
    aaguid: Uint8Array
    /** Variable-length credential id. */
    credentialId: Uint8Array
    /** COSE-encoded credential public key. */
    cosePublicKey: Uint8Array
}

export type AuthenticatorDataOptions = {
    rpId: string
    flags: { up: boolean; uv: boolean; at: boolean }
    /** Signature counter; serialized big-endian into 4 bytes. */
    signCount: number
    attestedCredentialData?: AttestedCredentialData
}

const u32be = (value: number): Uint8Array => {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new Error(`authenticatorData: signCount out of range: ${value}`)
    }
    return new Uint8Array([
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
    ])
}

const u16be = (value: number): Uint8Array => {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
        throw new Error(`authenticatorData: length out of range: ${value}`)
    }
    return new Uint8Array([(value >> 8) & 0xff, value & 0xff])
}

/**
 * Build the WebAuthn authenticator data byte string:
 * `rpIdHash(32) ‖ flags(1) ‖ signCount(4 BE)` followed, when the AT flag is
 * set, by `aaguid(16) ‖ credIdLen(2 BE) ‖ credentialId ‖ cosePublicKey`.
 */
export const buildAuthenticatorData = (
    opts: AuthenticatorDataOptions,
): Uint8Array => {
    const rpIdHash = sha256(new TextEncoder().encode(opts.rpId))

    let flags = 0
    if (opts.flags.up) flags |= FLAG_UP
    if (opts.flags.uv) flags |= FLAG_UV
    if (opts.flags.at) flags |= FLAG_AT

    const chunks: Uint8Array[] = [
        rpIdHash,
        new Uint8Array([flags]),
        u32be(opts.signCount),
    ]

    if (opts.flags.at) {
        const att = opts.attestedCredentialData
        if (!att) {
            throw new Error(
                'authenticatorData: AT flag set but no attested credential data',
            )
        }
        if (att.aaguid.length !== 16) {
            throw new Error(
                `authenticatorData: aaguid must be 16 bytes, got ${att.aaguid.length}`,
            )
        }
        chunks.push(
            att.aaguid,
            u16be(att.credentialId.length),
            att.credentialId,
            att.cosePublicKey,
        )
    }

    return concatBytes(chunks)
}
