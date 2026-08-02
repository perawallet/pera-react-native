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

// MAIN-world WebAuthn interceptor. No chrome.* available here. Wraps
// navigator.credentials.create/get and round-trips `publicKey` ceremonies to
// the ISOLATED relay over a per-load-randomized CustomEvent channel — the same
// pattern inject-main.ts uses for ARC-0027.
//
// FALL-THROUGH CONTRACT: every non-success outcome — no publicKey option,
// conditional mediation, a decline, a dead toggle, a timeout, a transport
// error, or a throw from this file's own serialize code — settles the page's
// promise with the STASHED ORIGINAL's outcome. This file never fabricates a
// rejection.
//
// The one exception is an `{ error: name }` response: a real
// authenticator-level failure from Pera's core, which must reject with that
// exact DOMException. Falling through past e.g. InvalidStateError would let the
// platform authenticator mint the very duplicate credential the RP excluded.
//
// BUNDLE SIZE: `import type` only from wallet-core-passkeys — importing its
// wire codec at runtime drags in the authenticator core and shared's full
// barrel, taking this script from ~2KB to ~900KB on EVERY page at
// document_start. The base64url codec and serialize functions below are a
// deliberate minimal duplication of the package's wire.ts, held
// wire-compatible by round-trip tests against the real codec.
import type {
    SerializedCreateOptions,
    SerializedCredential,
    SerializedGetOptions,
    SerializedPublicKeyCredentialDescriptor,
} from '@perawallet/wallet-core-passkeys/webauthn'
import {
    WEBAUTHN_CHANNEL_HANDSHAKE_EVENT,
    WEBAUTHN_CHANNEL_RELAY_READY_EVENT,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
} from './channel'
import {
    type WebauthnCeremonyRequest,
    type WebauthnCeremonyResponse,
} from '@perawallet/wallet-extension-platform-chrome'

// Must be captured BEFORE anything assigns to navigator.credentials — running
// after installProvider() would stash our own wrapper as "the original" and
// every fall-through would recurse instead of reaching the real implementation.
const nativeCredentials: CredentialsContainer | undefined =
    typeof navigator !== 'undefined' ? navigator.credentials : undefined
const origCreate = nativeCredentials?.create?.bind(nativeCredentials)
const origGet = nativeCredentials?.get?.bind(nativeCredentials)

const rand = (): string => globalThis.crypto.randomUUID().replace(/-/g, '')
const requestEventName = `__pera_webauthn_req_${rand()}__`
const responseEventName = `__pera_webauthn_res_${rand()}__`

// Backstop so a torn-down SW, or a relay that never answers, can't leave the
// page's promise pending forever.
const RELAY_TIMEOUT_MS = 120_000

let channelSeq = 0
let installed = false
const pending = new Map<string, (response: WebauthnCeremonyResponse) => void>()

type MainInstaller = (() => void) & {
    __requestEventName: string
    __responseEventName: string
}

const dispatchHandshake = (): void => {
    window.dispatchEvent(
        new CustomEvent(WEBAUTHN_CHANNEL_HANDSHAKE_EVENT, {
            detail: { requestEventName, responseEventName },
        }),
    )
}

// Duplicates wire.ts's codec — see the BUNDLE SIZE note above. `btoa`/`atob`
// operate on binary strings, which is what these loops build and consume.

const bytesToB64url = (bytes: Uint8Array): string => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '') // at most 2 chars — no ReDoS concern at this bound
}

const b64urlToBytes = (value: string): Uint8Array => {
    let std = value.replace(/-/g, '+').replace(/_/g, '/')
    const remainder = std.length % 4
    if (remainder === 2) std += '=='
    else if (remainder === 3) std += '='
    const binary = atob(std)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

/** Normalizes a WebAuthn `BufferSource` to a `Uint8Array` view. */
const bufferSourceToBytes = (input: BufferSource): Uint8Array =>
    input instanceof Uint8Array
        ? input
        : ArrayBuffer.isView(input)
          ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
          : new Uint8Array(input)

const serializeDescriptor = (
    descriptor: PublicKeyCredentialDescriptor,
): SerializedPublicKeyCredentialDescriptor => ({
    type: 'public-key',
    id: bytesToB64url(bufferSourceToBytes(descriptor.id)),
    ...(descriptor.transports ? { transports: descriptor.transports } : {}),
})

const serializeCreateOptions = (
    options: PublicKeyCredentialCreationOptions,
): SerializedCreateOptions => ({
    rp: options.rp,
    user: {
        id: bytesToB64url(bufferSourceToBytes(options.user.id)),
        name: options.user.name,
        displayName: options.user.displayName,
    },
    challenge: bytesToB64url(bufferSourceToBytes(options.challenge)),
    pubKeyCredParams: options.pubKeyCredParams,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.excludeCredentials
        ? {
              excludeCredentials:
                  options.excludeCredentials.map(serializeDescriptor),
          }
        : {}),
    ...(options.authenticatorSelection
        ? { authenticatorSelection: options.authenticatorSelection }
        : {}),
    ...(options.attestation ? { attestation: options.attestation } : {}),
    ...(options.extensions ? { extensions: options.extensions } : {}),
})

const serializeGetOptions = (
    options: PublicKeyCredentialRequestOptions,
): SerializedGetOptions => ({
    challenge: bytesToB64url(bufferSourceToBytes(options.challenge)),
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.rpId ? { rpId: options.rpId } : {}),
    ...(options.allowCredentials
        ? {
              allowCredentials:
                  options.allowCredentials.map(serializeDescriptor),
          }
        : {}),
    ...(options.userVerification
        ? { userVerification: options.userVerification }
        : {}),
    ...(options.extensions ? { extensions: options.extensions } : {}),
})

/** Copies `bytes` into a freshly-sized ArrayBuffer (no shared backing, no slack). */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer

/**
 * Rebuilds a `PublicKeyCredential`-shaped object from the wire codec's
 * `SerializedCredential`, restoring every base64url field to a real
 * ArrayBuffer — the shape a dapp's WebAuthn library expects back from
 * `navigator.credentials.create()`/`.get()`. Not a `PublicKeyCredential`
 * class instance (that constructor isn't exposed to script), just an
 * object matching its readable surface.
 */
const reconstructCredential = (
    serialized: SerializedCredential,
): Credential => {
    const response =
        'authenticatorData' in serialized.response
            ? {
                  clientDataJSON: toArrayBuffer(
                      b64urlToBytes(serialized.response.clientDataJSON),
                  ),
                  authenticatorData: toArrayBuffer(
                      b64urlToBytes(serialized.response.authenticatorData),
                  ),
                  signature: toArrayBuffer(
                      b64urlToBytes(serialized.response.signature),
                  ),
                  userHandle: serialized.response.userHandle
                      ? toArrayBuffer(
                            b64urlToBytes(serialized.response.userHandle),
                        )
                      : null,
              }
            : {
                  clientDataJSON: toArrayBuffer(
                      b64urlToBytes(serialized.response.clientDataJSON),
                  ),
                  attestationObject: toArrayBuffer(
                      b64urlToBytes(serialized.response.attestationObject),
                  ),
              }
    return {
        id: serialized.id,
        rawId: toArrayBuffer(b64urlToBytes(serialized.rawId)),
        type: 'public-key',
        response,
        authenticatorAttachment: null,
        getClientExtensionResults: () => ({}),
    } as unknown as Credential
}

// `null` on timeout; callers treat that and `{decline:true}` identically.
const callRelay = (
    request: WebauthnCeremonyRequest,
): Promise<WebauthnCeremonyResponse | null> =>
    new Promise(resolve => {
        const id = `${channelSeq++}`
        const timer = setTimeout(() => {
            if (!pending.delete(id)) return
            resolve(null)
        }, RELAY_TIMEOUT_MS)
        pending.set(id, response => {
            clearTimeout(timer)
            resolve(response)
        })
        window.dispatchEvent(
            new CustomEvent(requestEventName, {
                detail: { id, request } satisfies BridgeRequestEnvelope,
            }),
        )
    })

const fallThrough = <T>(
    original: ((options?: T) => Promise<Credential | null>) | undefined,
    options: T | undefined,
): Promise<Credential | null> => {
    if (!original) {
        // No CredentialsContainer at all — reject as a browser without
        // WebAuthn support would.
        return Promise.reject(
            new DOMException(
                'The operation is not supported.',
                'NotSupportedError',
            ),
        )
    }
    return original(options)
}

// Authenticator-level names reject with the matching native DOMException and
// must NOT fall through — see the FALL-THROUGH CONTRACT above.
const rejectWithAuthenticatorError = (name: string): never => {
    throw new DOMException(`WebAuthn ceremony failed: ${name}`, name)
}

const wrappedCreate = async (
    options?: CredentialCreationOptions,
): Promise<Credential | null> => {
    if (!options?.publicKey) return fallThrough(origCreate, options)

    let response: WebauthnCeremonyResponse | null
    try {
        response = await callRelay({
            kind: 'create',
            origin: location.origin,
            options: serializeCreateOptions(options.publicKey),
        })
    } catch {
        // Serialization threw on malformed page input, before the relay was
        // reached. Never surface a Pera-internal error — let native decide.
        return fallThrough(origCreate, options)
    }
    if (response && 'credential' in response) {
        try {
            return reconstructCredential(response.credential)
        } catch {
            // Malformed success payload — same rule, fall through.
            return fallThrough(origCreate, options)
        }
    }
    if (response && 'error' in response) {
        return rejectWithAuthenticatorError(response.error)
    }
    // decline / toggle-off / timeout / relay error — never fabricated here.
    return fallThrough(origCreate, options)
}

const wrappedGet = async (
    options?: CredentialRequestOptions,
): Promise<Credential | null> => {
    // Conditional mediation and non-publicKey requests are out of scope, so
    // defer without ever touching the relay. `create()` needs only the
    // publicKey check above — mediation is a `get()`-only concept.
    if (!options?.publicKey || options.mediation === 'conditional') {
        return fallThrough(origGet, options)
    }

    let response: WebauthnCeremonyResponse | null
    try {
        response = await callRelay({
            kind: 'get',
            origin: location.origin,
            options: serializeGetOptions(options.publicKey),
        })
    } catch {
        return fallThrough(origGet, options)
    }
    if (response && 'credential' in response) {
        try {
            return reconstructCredential(response.credential)
        } catch {
            return fallThrough(origGet, options)
        }
    }
    if (response && 'error' in response) {
        return rejectWithAuthenticatorError(response.error)
    }
    return fallThrough(origGet, options)
}

const installProvider = (): void => {
    // Idempotent: a second call re-wrapping the already-wrapped container
    // would stash its own wrapper as "original" and turn every fall-through
    // into infinite recursion.
    if (installed) return
    installed = true

    if (!nativeCredentials) return // no CredentialsContainer to intercept

    dispatchHandshake()
    window.addEventListener(
        WEBAUTHN_CHANNEL_RELAY_READY_EVENT,
        dispatchHandshake,
    )

    window.addEventListener(responseEventName, (e: Event) => {
        const { id, response } = (e as CustomEvent)
            .detail as BridgeResponseEnvelope<WebauthnCeremonyResponse>
        const resolve = pending.get(id)
        if (!resolve) return
        pending.delete(id)
        resolve(response)
    })

    // Deliberately a plain assignment, not a non-configurable defineProperty:
    // a page can reassign these and opt itself out of interception. Accepted,
    // not a gap — hardening would break password managers that legitimately
    // wrap `navigator.credentials`, and a page can only ever strip its OWN
    // interception, never spoof being intercepted or reach another frame.
    nativeCredentials.create = wrappedCreate as CredentialsContainer['create']
    nativeCredentials.get = wrappedGet as CredentialsContainer['get']
}

export const installWebauthnInterception = installProvider as MainInstaller
installWebauthnInterception.__requestEventName = requestEventName
installWebauthnInterception.__responseEventName = responseEventName

installWebauthnInterception()
