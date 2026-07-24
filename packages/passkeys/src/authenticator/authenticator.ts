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
 * Platform-agnostic WebAuthn authenticator core: builds create/get
 * ceremonies over an injected {@link KeystoreSigner}. This module depends
 * only on the CBOR/attestation structures, `@noble/hashes`, and
 * `@algorandfoundation/dp256` (for `rawToDER`) — never on keystore-chrome or
 * any `chrome.*` API, so it can run (and be tested) outside the extension.
 *
 * It is a byte-for-byte port of the ceremony assembly in
 * `PasskeyAutofillCredentialProvider/CredentialProviderViewController.swift` +
 * `WebAuthn.swift` — see per-function notes below for the exact lines it
 * mirrors.
 */

/**
 * Injected keystore port. keystore-chrome implements this; tests
 * use a fake. Every method takes/lists by `rpId` (the bare, validated
 * effective domain resolved by {@link resolveRpId}) — NEVER the full
 * scheme-qualified page origin. Naming it `rpId` (not `origin`) here is
 * deliberate: an earlier draft of this port called it `origin`, which is a
 * landmine for an implementer who'd reasonably expect the full origin.
 */
export type KeystoreSigner = {
    /**
     * Derives (or reuses) a domain-specific P-256 keypair and persists it.
     * `userHandle` here is the *derivation input* — the lowercased UTF-8
     * decoding of the WebAuthn `user.id` bytes (falling back to base64url
     * when the bytes aren't valid UTF-8), matching
     * `identity.userHandleString.lowercased()` in
     * `CredentialProviderViewController.swift:158,162`. It is NOT
     * necessarily byte-reversible to the original `user.id` — that's
     * intentional, mobile computes the same lossy string so both sides
     * derive the same keypair. Implementations MUST NOT feed
     * `userHandleOriginalB64Url` into key derivation — only `userHandle` is
     * the derivation input; changing that would silently derive a different
     * keypair than mobile's parity vector.
     *
     * `userHandleOriginalB64Url` is the byte-exact companion: base64url of
     * the RAW, case-preserving WebAuthn `user.id` bytes, unmodified by
     * lowercasing or UTF-8 (re)decoding. Implementations must persist this
     * verbatim (alongside, not instead of, the derivation `userHandle`) so
     * {@link KeystoreSigner.listP256Credentials} can return the RP's
     * original `user.id` bytes for `response.userHandle` on assertion —
     * required for discoverable/usernameless login, where the RP looks the
     * user up by that exact value.
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
     * Lists this RP ID's stored P-256 passkey credentials. `userHandle`
     * here is base64url of the ORIGINAL (case-preserved) `user.id` bytes —
     * i.e. the `userHandleOriginalB64Url` a matching
     * {@link createP256Credential} call persisted — the byte-exact form
     * needed to reconstruct `response.userHandle` on assertion, matching the
     * `Passkey.userHandle` convention documented in `../models/passkey.ts`.
     * This is deliberately a different encoding of "userHandle" than
     * {@link createP256Credential}'s `userHandle` (derivation-input) field;
     * see that field's doc for why.
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
     * The full serialized page origin the ceremony was intercepted on, e.g.
     * `https://webauthn.io` — used verbatim as `clientDataJSON.origin`
     * (RPs verify this includes the scheme). NOT the same value passed to
     * the `KeystoreSigner` (see {@link resolveRpId}).
     *
     * CRITICAL: this MUST be the browser-stamped, trustworthy frame origin
     * (read by the content script/service worker from the real frame, e.g.
     * `location.origin`) — NEVER a value asserted by the intercepted page
     * itself. `resolveRpId`'s registrable-suffix check below is the only
     * thing standing between a malicious page and registering/asserting a
     * credential under an `rp.id` it doesn't own; that check is only as
     * trustworthy as this field, which the transport layer must guarantee.
     */
    origin: string
}

/**
 * Thrown when the RP-supplied `rp.id`/`rpId` is not the caller's own
 * hostname or a registrable parent domain of it (WebAuthn §5.1.3 "relying
 * party identifier" — the client MUST reject an RP ID that isn't a
 * registrable domain suffix of, or equal to, the origin's effective domain).
 */
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
 * Real browsers validate this via the Public Suffix List (true eTLD+1); we
 * don't have a PSL here, so this is a label-boundary suffix check instead:
 * `rpId` must equal `hostname`, or `hostname` must end with `.${rpId}`. A
 * bare, dot-less `rpId` (e.g. `com`) is rejected unless it's an exact match
 * (covers `localhost`) — without this, `hostname.endsWith('.' + rpId)` would
 * accept `rpId: 'com'` for literally any `.com` origin.
 *
 * Known accepted gap: a contrived `rpId` that IS a real public suffix (e.g.
 * `co.uk` for an `x.co.uk` origin) passes this check but shouldn't per a
 * full eTLD+1 PSL lookup. Mobile never faced this — OS-mediated passkey
 * registration handles RP ID validation before this code ever runs. The
 * attack this check DOES stop — a page claiming an unrelated domain
 * (`rpId: 'evil.com'` from `webauthn.io`) — is the one that matters for an
 * extension intercepting page-level WebAuthn with no OS mediation.
 */
const isRegistrableSuffix = (rpId: string, hostname: string): boolean => {
    if (rpId === hostname) return true
    if (!rpId.includes('.')) return false
    return hostname.endsWith(`.${rpId}`)
}

/**
 * Resolves the WebAuthn RP ID (bare effective domain, e.g. `webauthn.io`,
 * no scheme) used for `SHA256(rpId)` in `authenticatorData` AND as the
 * `rpId` field passed to every `KeystoreSigner` method.
 *
 * This deliberately does NOT reuse `origin` (the full scheme-qualified
 * origin) for the signer calls: mobile's HD derivation
 * (`CredentialProviderViewController.swift:161`, `dP256.genDomainSpecificKeyPair`)
 * always hashes a bare RP ID domain (e.g. `identity.relyingPartyIdentifier`
 * is never scheme-qualified) — passing a scheme-qualified origin into the
 * signer here would derive a *different* keypair than mobile does for the
 * same site, silently breaking cross-device credential parity, this task's
 * whole point. When the RP doesn't set `rp.id`/`rpId` explicitly, this falls
 * back to the origin's hostname (or the raw string, if it doesn't parse as a
 * URL — e.g. a caller that already passed a bare domain as `origin`, which
 * the parity-vector test and fakes in this package's tests do for brevity).
 *
 * When the RP DOES set an explicit `rp.id`/`rpId`, it's validated against
 * `origin` (see {@link isRegistrableSuffix}) and rejected with
 * {@link SecurityError} if it names a domain the caller doesn't control —
 * per WebAuthn §5.1.3. A real OS-mediated authenticator (mobile's Credential
 * Provider) never has to make this check itself; a browser extension
 * intercepting page-level `navigator.credentials` calls does, since nothing
 * else here stops a page from asserting an `rp.id` it doesn't own.
 */
export const resolveRpId = (
    rpIdFromOptions: string | undefined,
    origin: string,
): string => {
    const hostname = extractHostname(origin)
    if (!rpIdFromOptions) return hostname
    // WebAuthn RP IDs are case-insensitive domains; new URL().hostname is
    // already lowercased, so normalize the RP-supplied value before comparing
    // (and drop a fully-qualified trailing dot) — otherwise a legit RP passing
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
 * Fixed P-256 SubjectPublicKeyInfo (X.509) DER prefix, up to and including
 * the BIT STRING header (`03 42 00`) — identical constant to
 * `packages/migrate/src/migrate/passkeys/deriveLegacyPasskeyCredential.ts`'s
 * `P256_SPKI_PREFIX`. A full uncompressed-point SPKI is this 26-byte prefix,
 * followed by the `0x04` uncompressed-point indicator and the 64-byte
 * `X || Y` coordinates (91 bytes total).
 */
const P256_SPKI_PREFIX = Uint8Array.from([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
])

/**
 * Wraps a P-256 public key in X.509/SPKI DER — the exact bytes CryptoKit's
 * `derRepresentation` produces. Accepts either the raw 64-byte `X || Y` form
 * or the 65-byte `0x04`-prefixed form (normalized via
 * `splitP256PublicKey`, rather than assuming the `KeystoreSigner` always
 * hands back exactly 64 bytes).
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
 * Derives `credentialId = SHA256(publicKey)`.
 *
 * FINDING — which form of the public key gets hashed: mobile's *current*
 * (non-legacy) passkey registration path is
 * `CredentialProviderViewController.swift:164-165`:
 *
 * ```swift
 * let publicKey = privateKey.publicKey.derRepresentation   // SPKI DER, 91 bytes
 * let credentialId = WebAuthn.credentialId(publicKey: publicKey)
 * ```
 *
 * `WebAuthn.credentialId` (`WebAuthn.swift:58-60`) just hashes whatever
 * `Data` it's handed — it's the caller here that fixes the form to SPKI DER,
 * not the raw 64-byte point or the 65-byte `0x04`-prefixed point. This also
 * matches the default `credentialIdBasis: 'spki-der'` in
 * `packages/migrate/src/migrate/passkeys/deriveLegacyPasskeyCredential.ts`
 * (Android's legacy basis, and now the shared live-registration default).
 * `'raw-point'` there is the iOS-*legacy*-app basis, superseded by this
 * unified Credential Provider — this authenticator matches the live path so
 * a credential registered by the extension can be asserted by mobile (and
 * vice versa) without a credentialId mismatch.
 *
 * So: this hashes the 91-byte SPKI DER encoding of the raw 64-byte
 * `publicKeyXY`, NOT the 64 or 65-byte raw point forms.
 */
export const deriveCredentialId = (publicKeyXY: Uint8Array): Uint8Array =>
    sha256(p256XYToSpkiDer(publicKeyXY))

/**
 * Derives the dp256 derivation-input userHandle string: UTF-8 decode of the
 * raw `user.id` bytes (falling back to base64url if not valid UTF-8), then
 * lowercased. Mirrors `identity.userHandleString.lowercased()` in
 * `CredentialProviderViewController.swift:158,162` and
 * `ASPasskeyCredentialIdentity.userHandleString` (`String(data:encoding:.utf8)
 * ?? base64URLEncodedString()`, `CredentialProviderViewController.swift:456-457`).
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
 * Builds `clientDataJSON`: `{type, challenge, origin, crossOrigin: false}`.
 * Object-literal key insertion order is `type, challenge, origin,
 * crossOrigin` and `JSON.stringify` preserves it (string keys, no numeric
 * coercion) — this is the stable key order relying parties are written
 * against.
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

/**
 * Handles `navigator.credentials.create()`. Rejects an `rp.id` that isn't
 * the caller's own domain or a registrable parent of it with
 * {@link SecurityError} (see {@link resolveRpId}). Honors
 * `excludeCredentials` (throws {@link InvalidStateError} if this origin
 * already has one of the named credentials), derives a fresh
 * domain-specific P-256 keypair via `signer`, and assembles the
 * `none`-format attestation.
 */
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
 * Handles `navigator.credentials.get()`. Rejects an `rpId` that isn't the
 * caller's own domain or a registrable parent of it with
 * {@link SecurityError} (see {@link resolveRpId}). Resolves the credential
 * to assert with from `allowCredentials ∩ listP256Credentials(rpId)` — or,
 * when `allowCredentials` is empty/absent (a discoverable-credential
 * request), the first credential this RP ID has. (Presenting a picker
 * across multiple discoverable credentials is a UI concern for a later
 * task, not this crypto core.) Signs `authenticatorData ‖
 * SHA256(clientDataJSON)` and DER-encodes the result.
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
        // `resolved.userHandle` is base64url text (see KeystoreSigner doc
        // above) — decode back to raw bytes for the response, matching what
        // `serializeCredential` re-encodes.
        userHandle: b64urlToBytes(resolved.userHandle),
    }
    return serializeCredential({
        id: resolved.credentialId,
        type: 'public-key',
        response,
    })
}
