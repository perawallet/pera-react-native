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
import {
    buildAuthenticatorData,
    buildClientDataJSON,
    buildNoneAttestationObject,
    coseP256PublicKey,
    fromBase64Url,
    rawToDerEcdsaSignature,
    toBase64Url,
} from './webauthn'

/** The 32-byte big-endian affine coordinates of a P-256 public key. */
export type P256PublicKeyXY = {
    x: Uint8Array
    y: Uint8Array
}

/**
 * The narrow set of P-256 keystore operations the mechanism needs. Injected so
 * the orchestration is unit-testable with deterministic fakes; the real
 * implementation (see {@link createKeystoreP256KeyAccess}) wires these to the
 * `@algorandfoundation/react-native-keystore` backend.
 */
export type P256KeyAccess = {
    /**
     * Deterministically derives (or re-derives) the P-256 credential for an
     * (origin, userHandle) pair from the HD seed and returns the keystore key
     * id, the WebAuthn credentialId, and the public-key coordinates.
     */
    deriveP256(params: { origin: string; userHandle: string }): Promise<{
        keyId: string
        credentialId: string
        publicKeyXY: P256PublicKeyXY
    }>
    /**
     * Resolves an existing credential by its WebAuthn credentialId (base64url).
     * Returns `null` when no matching keystore key is present.
     */
    getP256(
        credentialId: string,
    ): Promise<{ keyId: string; publicKeyXY: P256PublicKeyXY } | null>
    /**
     * Signs `bytes` AS-IS (no internal hashing) with the P-256 key, returning a
     * raw 64-byte `r ‖ s` signature. WebAuthn requires the caller to pass the
     * already-computed `sha256(authData ‖ sha256(clientDataJSON))`.
     */
    signP256(keyId: string, bytes: Uint8Array): Promise<Uint8Array>
}

/**
 * WebAuthn attestation/assertion responses are serialized as JSON and POSTed to
 * the Liquid Auth server, so every binary field is base64url-encoded (the same
 * shape SimpleWebAuthn / `AuthenticationResponseJSON` produce).
 */
type AttestationResponse = {
    attestationObject: string
    clientDataJSON: string
}

type AssertionResponse = {
    authenticatorData: string
    clientDataJSON: string
    signature: string
    userHandle: string
}

type CreateResult = {
    id: string
    rawId: string
    type: 'public-key'
    response: AttestationResponse
    clientExtensionResults: Record<string, unknown>
}

type GetResult = {
    id: string
    rawId: string
    type: 'public-key'
    response: AssertionResponse
    clientExtensionResults: Record<string, unknown>
}

export type KeystoreCredentialMechanism = {
    create(options: unknown): Promise<CreateResult>
    get(options: unknown): Promise<GetResult>
}

export type KeystoreCredentialMechanismDeps = {
    keyAccess: P256KeyAccess
    /**
     * Optional biometric/UV gate. Awaited before any key derivation or signing.
     * When it resolves `false` the ceremony is rejected.
     */
    requireUserVerification?: () => Promise<boolean>
}

/** 16 zero bytes — Pera is a software authenticator, so it has no AAGUID. */
const AAGUID = new Uint8Array(16)

type CredentialCreationOptions = {
    rp?: { id?: string; name?: string }
    user?: { id?: string; name?: string; displayName?: string }
    challenge?: string
}

type CredentialRequestOptions = {
    rpId?: string
    challenge?: string
    allowCredentials?: { id?: string; type?: string }[]
}

/** Accept both `{ publicKey: {...} }` (DOM shape) and the bare options object. */
const unwrap = <T>(options: unknown): T => {
    const obj = (options ?? {}) as { publicKey?: T } & T
    return (obj.publicKey ?? obj) as T
}

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)

const decodeChallenge = (challenge: string | undefined): Uint8Array => {
    if (!challenge) {
        throw new Error('keystoreCredentials: missing challenge')
    }
    return fromBase64Url(challenge)
}

const gateUserVerification = async (
    requireUserVerification?: () => Promise<boolean>,
): Promise<void> => {
    if (!requireUserVerification) return
    const ok = await requireUserVerification()
    if (!ok) {
        throw new Error('keystoreCredentials: user verification failed')
    }
}

/**
 * Builds the credential mechanism around an injected {@link P256KeyAccess}.
 * This is the pure orchestration core (no keystore / biometric coupling) and is
 * the unit under test. Production code uses
 * {@link createKeystoreCredentialMechanism}, which supplies the real adapter.
 */
export const createKeystoreCredentialMechanismCore = (
    deps: KeystoreCredentialMechanismDeps,
): KeystoreCredentialMechanism => {
    const { keyAccess, requireUserVerification } = deps

    const create = async (options: unknown): Promise<CreateResult> => {
        const opts = unwrap<CredentialCreationOptions>(options)
        const rpId = opts.rp?.id
        if (!rpId) {
            throw new Error('keystoreCredentials: missing rp.id')
        }
        // The server checks two distinct values: `expectedRPID` is the bare
        // hostname (drives our authenticatorData rpIdHash), while
        // `expectedOrigin` for a web client is the full origin WITH scheme. The
        // server's rp.id is the bare host, so reconstruct the https origin for
        // clientDataJSON. (A scheme-less origin matches neither the web origin
        // nor an android:apk-key-hash origin and fails verifyRegistrationResponse.)
        const clientOrigin = `https://${rpId}`
        // Prefer the human-readable user.name as the userHandle (matches the
        // passkey-autofill convention); fall back to the opaque user.id.
        const userHandle = opts.user?.name ?? opts.user?.id
        if (!userHandle) {
            throw new Error('keystoreCredentials: missing user identifier')
        }
        const challenge = decodeChallenge(opts.challenge)

        await gateUserVerification(requireUserVerification)

        const { credentialId, publicKeyXY } = await keyAccess.deriveP256({
            origin: rpId,
            userHandle,
        })
        const credentialIdBytes = fromBase64Url(credentialId)

        const authData = buildAuthenticatorData({
            rpId,
            flags: { up: true, uv: true, at: true },
            signCount: 0,
            attestedCredentialData: {
                aaguid: AAGUID,
                credentialId: credentialIdBytes,
                cosePublicKey: coseP256PublicKey(publicKeyXY.x, publicKeyXY.y),
            },
        })
        const attestationObject = buildNoneAttestationObject(authData)
        const clientData = buildClientDataJSON({
            type: 'webauthn.create',
            challenge,
            origin: clientOrigin,
        })

        return {
            id: credentialId,
            rawId: credentialId,
            type: 'public-key',
            response: {
                attestationObject: toBase64Url(attestationObject),
                clientDataJSON: toBase64Url(clientData.bytes),
            },
            // Mutable so the ceremony can stamp `clientExtensionResults.liquid`.
            clientExtensionResults: {},
        }
    }

    const get = async (options: unknown): Promise<GetResult> => {
        const opts = unwrap<CredentialRequestOptions>(options)
        const rpId = opts.rpId
        if (!rpId) {
            throw new Error('keystoreCredentials: missing rpId')
        }
        // Bare host drives the rpIdHash; the full https origin goes in
        // clientDataJSON (see the create() note above).
        const clientOrigin = `https://${rpId}`
        const challenge = decodeChallenge(opts.challenge)

        const allow = opts.allowCredentials ?? []
        const credentialId = allow.find(c => c.id)?.id
        if (!credentialId) {
            throw new Error('keystoreCredentials: no allowCredentials provided')
        }

        const resolved = await keyAccess.getP256(credentialId)
        if (!resolved) {
            throw new Error(
                `keystoreCredentials: no credential for id ${credentialId}`,
            )
        }

        await gateUserVerification(requireUserVerification)

        // signCount stays 0 for v1: Pera does not persist a per-credential
        // counter, and the Liquid Auth server does not enforce monotonicity.
        const authData = buildAuthenticatorData({
            rpId,
            flags: { up: true, uv: true, at: false },
            signCount: 0,
        })
        const clientData = buildClientDataJSON({
            type: 'webauthn.get',
            challenge,
            origin: clientOrigin,
        })

        // WebAuthn assertion signature base: sha256(authData ‖ sha256(clientData)).
        const clientDataHash = sha256(clientData.bytes)
        const signedPayload = sha256(concat(authData, clientDataHash))
        const rawSignature = await keyAccess.signP256(
            resolved.keyId,
            signedPayload,
        )
        const derSignature = rawToDerEcdsaSignature(rawSignature)

        return {
            id: credentialId,
            rawId: credentialId,
            type: 'public-key',
            response: {
                authenticatorData: toBase64Url(authData),
                clientDataJSON: toBase64Url(clientData.bytes),
                signature: toBase64Url(derSignature),
                userHandle: toBase64Url(utf8(extractUserHandle(opts))),
            },
            clientExtensionResults: {},
        }
    }

    return { create, get }
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
    const out = new Uint8Array(a.length + b.length)
    out.set(a, 0)
    out.set(b, a.length)
    return out
}

/**
 * The assertion request does not carry the user handle; the server only needs a
 * non-empty value for the `userHandle` field. We echo the rpId as a stable
 * placeholder when nothing better is available.
 */
const extractUserHandle = (opts: CredentialRequestOptions): string =>
    opts.rpId ?? ''
