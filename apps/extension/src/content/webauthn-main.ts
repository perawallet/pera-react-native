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

// MAIN-world WebAuthn interceptor. No chrome.* here (MAIN world has none —
// see inject-main.ts's header for the same constraint). Wraps
// navigator.credentials.create/get and round-trips `publicKey` ceremonies to
// the ISOLATED relay (webauthn-relay.ts) over a per-load-randomized
// CustomEvent channel, the same ARC-0027 pattern inject-main.ts/
// relay-isolated.ts use.
//
// FALL-THROUGH CONTRACT (the whole point of this file): the stashed
// `origCreate`/`origGet` are captured synchronously, before anything wraps
// `navigator.credentials`, so the real implementation is always available as
// the terminal path. Every non-success outcome — no publicKey option,
// conditional mediation, a relay decline, a dead/uninstalled toggle, a
// timeout, a transport error, or a throw from this file's own
// serialize/reconstruct code (malformed page input or a malformed relay
// payload) — resolves/rejects the page's promise with the STASHED
// ORIGINAL's own outcome. The one deliberate exception is a `{ error: name }`
// response: that's a REAL authenticator-level failure (InvalidStateError,
// SecurityError, ...) surfaced by Task 2's authenticator core, and it must
// reject with that exact native DOMException rather than fall through —
// falling through past e.g. InvalidStateError would let the platform
// authenticator mint a duplicate credential the RP explicitly tried to
// exclude, silently defeating the check that produced the error. Short of
// that one case, this file never fabricates a rejection of its own; it
// either hands back a real Pera-minted credential, surfaces Pera's own
// authenticator error verbatim, or gets out of the way entirely and lets the
// browser's real WebAuthn implementation (platform authenticator, security
// key, etc.) decide.
//
// BUNDLE-SIZE NOTE: only `import type` from `@perawallet/wallet-core-passkeys`
// below — those vanish entirely at build time (erased by the TS/esbuild
// compile step), so they cost this bundle nothing. The serialize/deserialize
// *functions* from that package's wire codec are deliberately NOT imported
// here at runtime: pulling in `@perawallet/wallet-core-passkeys/webauthn`
// drags in its authenticator core (`@algorandfoundation/dp256`) and
// `@perawallet/wallet-core-shared`'s full barrel (react-query, zod, ky,
// decimal.js, ...) transitively, ballooning this script from ~2KB to
// ~900KB — a cost paid on EVERY http/https page at document_start
// (all_frames), unlike Task 2-4's SW/approval-window contexts where that
// weight is a non-issue. The base64url codec + serialize functions below are
// therefore a deliberate, minimal duplication of
// packages/passkeys/src/authenticator/wire.ts, kept byte-for-byte
// wire-compatible with it (see __tests__/webauthn-main.test.ts's round-trip
// tests against the real package's codec, which catch any drift).
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

// Captured BEFORE anything below ever assigns to navigator.credentials.
// Order matters: if this ran after installProvider() wrapped the container,
// it would stash our own wrapper as "the original" and every fall-through
// would recurse into itself instead of reaching the browser's real
// implementation.
const nativeCredentials: CredentialsContainer | undefined =
    typeof navigator !== 'undefined' ? navigator.credentials : undefined
const origCreate = nativeCredentials?.create?.bind(nativeCredentials)
const origGet = nativeCredentials?.get?.bind(nativeCredentials)

const rand = (): string => globalThis.crypto.randomUUID().replace(/-/g, '')
const requestEventName = `__pera_webauthn_req_${rand()}__`
const responseEventName = `__pera_webauthn_res_${rand()}__`

// Safety timeout so a torn-down SW (or a relay that never answers) can never
// leave the page's create()/get() promise pending forever — mirrors
// inject-main.ts's 120s ARC-0027 backstop.
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

// --- Minimal base64url (RFC 4648 §5) codec — see the BUNDLE-SIZE NOTE above
// for why this duplicates wire.ts's bytesToB64url/b64urlToBytes instead of
// importing them. `btoa`/`atob` operate on binary strings (one code unit per
// byte), which is exactly what these loops build/consume.

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

// Sends `request` to the relay and resolves with its terminal response, or
// `null` on timeout — callers treat both a `null` and a `{decline:true}`
// response identically (fall through to the stashed original).
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
        // No native implementation to fall through to at all (an
        // environment with no CredentialsContainer whatsoever) — reject the
        // way a browser lacking WebAuthn support would.
        return Promise.reject(
            new DOMException(
                'The operation is not supported.',
                'NotSupportedError',
            ),
        )
    }
    return original(options)
}

// Thrown authenticator-level names (InvalidStateError, SecurityError,
// NotAllowedError, ...) reject the page's promise with the matching native
// DOMException — see webauthn-router-protocol.ts's WebauthnCeremonyResponse
// doc for why this must NOT fall through to native (a fall-through past e.g.
// InvalidStateError would let the platform authenticator mint a duplicate
// credential the RP explicitly tried to exclude).
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
        // Malformed page input (e.g. a `challenge`/`user.id` that isn't a
        // real BufferSource) threw during serialization, before the relay
        // was ever reached — never surface a Pera-internal error to the
        // page; let native decide what to do with the same options.
        return fallThrough(origCreate, options)
    }
    if (response && 'credential' in response) {
        try {
            return reconstructCredential(response.credential)
        } catch {
            // A malformed "success" payload from the relay/SW — same rule:
            // never throw Pera internals at the page, fall through instead.
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
    // Conditional mediation (autofill UI) and non-publicKey requests are out
    // of scope for this interception layer — always defer to the real
    // implementation, and never touch the relay channel for them. (There is
    // no equivalent `mediation` option on `create()` today — WebAuthn's
    // conditional-UI mediation is a `get()`-only concept — so create() only
    // needs the publicKey check above.)
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
    // Idempotent: same rationale as inject-main.ts — guards against
    // double-wrapping navigator.credentials if this module is ever
    // re-invoked (re-injection, or a test calling install() again). A
    // second call re-wrapping the ALREADY-wrapped container would stash its
    // own wrapper as "original," breaking every fall-through into infinite
    // recursion — the guard is what keeps origCreate/origGet pinned to the
    // one true native implementation captured at module load.
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

    // NOT hardened against reassignment (deliberately): a plain property
    // assignment, not `Object.defineProperty` with `configurable: false`.
    // A page (or another extension's content script) can freely reassign
    // `navigator.credentials.create`/`.get` again after this — including
    // right back to `origCreate`/`origGet`, opting itself out of Pera's
    // interception entirely. That's accepted, not a gap to close: making
    // this non-configurable would also break any legitimate page or
    // password-manager extension that wraps `navigator.credentials` itself
    // (a common, non-hostile pattern), and a page can only ever strip its
    // OWN interception this way — it has no way to spoof being intercepted
    // when it isn't, or to reach another frame's wrapped container.
    nativeCredentials.create = wrappedCreate as CredentialsContainer['create']
    nativeCredentials.get = wrappedGet as CredentialsContainer['get']
}

export const installWebauthnInterception = installProvider as MainInstaller
installWebauthnInterception.__requestEventName = requestEventName
installWebauthnInterception.__responseEventName = responseEventName

installWebauthnInterception()
