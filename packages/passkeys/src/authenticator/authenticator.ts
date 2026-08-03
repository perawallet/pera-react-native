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
import { concatBytes } from '@perawallet/wallet-core-shared'
import {
    authenticatorData,
    attestationObjectNone,
    splitP256PublicKey,
} from './webauthn-structures'
import {
    b64urlToBytes,
    bufferSourceToBytes,
    bytesToB64url,
    serializeCredential,
    type RawAssertionResponse,
    type RawAttestationResponse,
    type SerializedCredential,
} from './wire'

/**
 * Platform-agnostic WebAuthn authenticator core. Must never depend on
 * keystore-chrome or any `chrome.*` API, so it can run (and be tested)
 * outside the extension.
 *
 * Byte-for-byte port of the ceremony assembly in mobile's
 * `CredentialProviderViewController.swift` + `WebAuthn.swift`.
 */

/**
 * Every method takes `rpId` — the bare, validated effective domain from
 * {@link resolveRpId} — NEVER the full scheme-qualified page origin.
 */
export type KeystoreSigner = {
    /**
     * `userHandle` is the *derivation input*: the lowercased UTF-8 decoding of
     * `user.id` (base64url fallback when not valid UTF-8), matching mobile's
     * `identity.userHandleString.lowercased()`. Deliberately lossy — both
     * sides compute the same lossy string, so both derive the same keypair.
     * Feeding `userHandleOriginalB64Url` into derivation instead would
     * silently diverge from mobile's parity vector.
     *
     * `userHandleOriginalB64Url` is the byte-exact companion, persisted
     * alongside (not instead of) it so {@link listP256Credentials} can return
     * the RP's original `user.id` for `response.userHandle` — required for
     * discoverable login, where the RP looks the user up by that exact value.
     */
    createP256Credential(input: {
        rpId: string
        userHandle: string
        userHandleOriginalB64Url: string
        displayName: string
        userName?: string
    }): Promise<{ keyId: string; publicKeyXY: Uint8Array }>
    /** Signs `data` with the P-256 key `keyId`; returns a RAW 64-byte (r‖s) signature — DER-encoding happens in this core. */
    signP256(keyId: string, data: Uint8Array): Promise<Uint8Array>
    /**
     * `userHandle` here is the persisted `userHandleOriginalB64Url`, NOT the
     * derivation-input `userHandle` of {@link createP256Credential} — a
     * deliberately different encoding. See that field's doc.
     */
    listP256Credentials(rpId: string): Promise<
        Array<{
            keyId: string
            credentialId: Uint8Array
            publicKeyXY: Uint8Array
            userHandle: string
        }>
    >
}

export type SigningContext = {
    /**
     * Full scheme-qualified page origin, e.g. `https://webauthn.io`. Used
     * verbatim as `clientDataJSON.origin`; NOT what reaches `KeystoreSigner`
     * (see {@link resolveRpId}).
     *
     * CRITICAL: must be the browser-stamped frame origin (`location.origin`
     * read from the real frame) — NEVER a value asserted by the intercepted
     * page. `resolveRpId`'s registrable-suffix check is all that stops a
     * malicious page claiming an `rp.id` it doesn't own, and that check is
     * only as trustworthy as this field.
     */
    origin: string
}

/** WebAuthn §5.1.3: the RP ID must be a registrable suffix of the origin. */
export class SecurityError extends Error {
    constructor(
        message = 'The relying party ID is not a registrable domain suffix of, or equal to, the caller origin.',
    ) {
        super(message)
        this.name = 'SecurityError'
    }
}

const extractHostname = (origin: string): string => {
    try {
        return new URL(origin).hostname
    } catch {
        return origin
    }
}

/**
 * A label-boundary suffix check standing in for the Public Suffix List, which
 * we don't have here. The dot-less rejection matters: without it,
 * `hostname.endsWith('.' + rpId)` would accept `rpId: 'com'` for any `.com`
 * origin. The exact-match escape hatch covers `localhost`.
 *
 * Accepted gap: an `rpId` that IS a real public suffix (`co.uk` for an
 * `x.co.uk` origin) passes but shouldn't under a true eTLD+1 lookup. The
 * attack that matters — a page claiming `evil.com` from `webauthn.io` — is
 * still stopped.
 */
const isRegistrableSuffix = (rpId: string, hostname: string): boolean => {
    if (rpId === hostname) return true
    if (!rpId.includes('.')) return false
    return hostname.endsWith(`.${rpId}`)
}

/**
 * The bare effective domain (e.g. `webauthn.io`) used for `SHA256(rpId)` in
 * `authenticatorData` and passed to every `KeystoreSigner` method.
 *
 * Deliberately not `origin`: mobile's HD derivation always hashes a bare RP
 * ID, so feeding a scheme-qualified origin to the signer would derive a
 * different keypair for the same site and silently break cross-device parity.
 *
 * An explicit RP-supplied `rp.id` is validated against `origin` and rejected
 * with {@link SecurityError} per WebAuthn §5.1.3. Mobile's OS-mediated
 * authenticator never needs this check; an extension intercepting page-level
 * `navigator.credentials` does.
 */
export const resolveRpId = (
    rpIdFromOptions: string | undefined,
    origin: string,
): string => {
    const hostname = extractHostname(origin)
    if (!rpIdFromOptions) return hostname
    // `URL().hostname` is already lowercased, so normalize the RP-supplied
    // value too (and drop a trailing dot) — otherwise a legit RP passing
    // `rp.id: 'Example.com'` would fail-closed to a SecurityError.
    const normalizedRpId = rpIdFromOptions.toLowerCase().replace(/\.$/, '')
    if (!isRegistrableSuffix(normalizedRpId, hostname)) {
        throw new SecurityError()
    }
    return normalizedRpId
}

/** Thrown from `createCredential` when `excludeCredentials` names a credential this origin already has (WebAuthn `InvalidStateError`). */
export class InvalidStateError extends Error {
    constructor(
        message = 'The user attempted to register an authenticator that contains one of the credentials already registered with the relying party.',
    ) {
        super(message)
        this.name = 'InvalidStateError'
    }
}

/** Thrown from `assertCredential` when no stored credential matches `allowCredentials` (or none exist at all) — WebAuthn `NotAllowedError`. */
export class NotAllowedError extends Error {
    constructor(
        message = 'The operation either timed out or was not allowed.',
    ) {
        super(message)
        this.name = 'NotAllowedError'
    }
}

const dp256 = new DeterministicP256()

/**
 * P-256 SPKI (X.509) DER prefix through the BIT STRING header. Duplicated in
 * `migrate/passkeys/deriveLegacyPasskeyCredential.ts` — keep in sync. Full
 * SPKI = this 26-byte prefix + `0x04` + 64-byte `X || Y` = 91 bytes.
 */
const P256_SPKI_PREFIX = Uint8Array.from([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
])

/**
 * Produces the exact bytes CryptoKit's `derRepresentation` does. Accepts the
 * raw 64-byte `X || Y` or 65-byte `0x04`-prefixed form, since the
 * `KeystoreSigner` isn't guaranteed to hand back exactly 64 bytes.
 */
export const p256XYToSpkiDer = (publicKeyXY: Uint8Array): Uint8Array => {
    const { x, y } = splitP256PublicKey(publicKeyXY)
    const der = new Uint8Array(
        P256_SPKI_PREFIX.length + 1 + x.length + y.length,
    )
    der.set(P256_SPKI_PREFIX, 0)
    der[P256_SPKI_PREFIX.length] = 0x04
    der.set(x, P256_SPKI_PREFIX.length + 1)
    der.set(y, P256_SPKI_PREFIX.length + 1 + x.length)
    return der
}

/**
 * Hashes the 91-byte SPKI DER encoding, NOT the 64- or 65-byte raw point
 * forms. Mobile's live registration path hashes `derRepresentation`, and
 * `deriveLegacyPasskeyCredential`'s default `credentialIdBasis: 'spki-der'`
 * agrees; matching it is what lets a credential registered by the extension
 * be asserted by mobile without a credentialId mismatch.
 */
export const deriveCredentialId = (publicKeyXY: Uint8Array): Uint8Array =>
    sha256(p256XYToSpkiDer(publicKeyXY))

/**
 * Mirrors iOS `ASPasskeyCredentialIdentity.userHandleString.lowercased()`
 * (`String(data:encoding:.utf8) ?? base64URLEncodedString()`).
 */
const toDerivationUserHandle = (userId: Uint8Array): string => {
    let decoded: string
    try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(userId)
    } catch {
        decoded = bytesToB64url(userId)
    }
    return decoded.toLowerCase()
}

/**
 * Key order is load-bearing: `JSON.stringify` preserves insertion order for
 * string keys, and relying parties are written against this exact order.
 */
export const buildClientDataJSON = (
    type: 'webauthn.create' | 'webauthn.get',
    challenge: Uint8Array,
    origin: string,
): Uint8Array =>
    new TextEncoder().encode(
        JSON.stringify({
            type,
            challenge: bytesToB64url(challenge),
            origin,
            crossOrigin: false,
        }),
    )

const idsMatch = (a: Uint8Array, b: Uint8Array): boolean =>
    bytesToB64url(a) === bytesToB64url(b)

/** Handles `navigator.credentials.create()`, with `none`-format attestation. */
export const createCredential = async (
    options: PublicKeyCredentialCreationOptions,
    signer: KeystoreSigner,
    { origin }: SigningContext,
): Promise<SerializedCredential> => {
    const rpId = resolveRpId(options.rp.id, origin)

    const excludeIds = (options.excludeCredentials ?? []).map(descriptor =>
        bufferSourceToBytes(descriptor.id),
    )
    if (excludeIds.length > 0) {
        const existing = await signer.listP256Credentials(rpId)
        const collides = existing.some(credential =>
            excludeIds.some(excluded =>
                idsMatch(excluded, credential.credentialId),
            ),
        )
        if (collides) {
            throw new InvalidStateError()
        }
    }

    const userIdBytes = bufferSourceToBytes(options.user.id)
    const { publicKeyXY } = await signer.createP256Credential({
        rpId,
        userHandle: toDerivationUserHandle(userIdBytes),
        userHandleOriginalB64Url: bytesToB64url(userIdBytes),
        displayName: options.user.displayName,
        userName: options.user.name,
    })

    const credentialId = deriveCredentialId(publicKeyXY)
    const publicKeyPoint = splitP256PublicKey(publicKeyXY)

    const clientDataJSON = buildClientDataJSON(
        'webauthn.create',
        bufferSourceToBytes(options.challenge),
        origin,
    )
    const authData = await authenticatorData({
        rpId,
        attested: true,
        credentialId,
        publicKeyXY: publicKeyPoint,
    })
    const attestationObject = attestationObjectNone(authData)

    const response: RawAttestationResponse = {
        clientDataJSON,
        attestationObject,
    }
    return serializeCredential({
        id: credentialId,
        type: 'public-key',
        response,
    })
}

/**
 * Handles `navigator.credentials.get()`, signing
 * `authenticatorData ‖ SHA256(clientDataJSON)`.
 *
 * A discoverable request (no `allowCredentials`) takes the RP's first
 * credential — picking among several is a UI concern, not this crypto core's.
 */
export const assertCredential = async (
    options: PublicKeyCredentialRequestOptions,
    signer: KeystoreSigner,
    { origin }: SigningContext,
): Promise<SerializedCredential> => {
    const rpId = resolveRpId(options.rpId, origin)
    const candidates = await signer.listP256Credentials(rpId)

    const allowIds = options.allowCredentials?.map(descriptor =>
        bufferSourceToBytes(descriptor.id),
    )
    const resolved =
        allowIds && allowIds.length > 0
            ? candidates.find(credential =>
                  allowIds.some(allowed =>
                      idsMatch(allowed, credential.credentialId),
                  ),
              )
            : candidates[0]

    if (!resolved) {
        throw new NotAllowedError()
    }

    const clientDataJSON = buildClientDataJSON(
        'webauthn.get',
        bufferSourceToBytes(options.challenge),
        origin,
    )
    const authData = await authenticatorData({ rpId, attested: false })
    const clientDataHash = sha256(clientDataJSON)
    const signedPayload = concatBytes(authData, clientDataHash)
    const rawSignature = await signer.signP256(resolved.keyId, signedPayload)
    const signature = dp256.rawToDER(rawSignature)

    const response: RawAssertionResponse = {
        clientDataJSON,
        authenticatorData: authData,
        signature,
        // base64url text per the KeystoreSigner doc — decode to raw bytes so
        // `serializeCredential` re-encodes the RP's original `user.id`.
        userHandle: b64urlToBytes(resolved.userHandle),
    }
    return serializeCredential({
        id: resolved.credentialId,
        type: 'public-key',
        response,
    })
}
