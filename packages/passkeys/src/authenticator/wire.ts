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

import {
    decodeFromBase64,
    encodeToBase64,
    toUrlSafeBase64,
} from '@perawallet/wallet-core-shared'

/**
 * Base64url (no padding, `-_` alphabet) codec for every ArrayBuffer-bearing
 * field of the WebAuthn create/get ceremony, plus the credential returned
 * from it. This is the wire format the interception layer (content script
 * <-> background) passes ceremony messages in, and the exact shape
 * `authenticator.ts` emits for its returned credential — ArrayBuffers don't
 * survive some messaging boundaries cleanly and JSON is easier to log/debug.
 */

/** Encodes raw bytes as base64url (RFC 4648 §5): no `=` padding, `-`/`_` in place of `+`/`/`. */
export const bytesToB64url = (bytes: Uint8Array): string =>
    toUrlSafeBase64(encodeToBase64(bytes))

/** Decodes a base64url string (padded or not) back to raw bytes. */
export const b64urlToBytes = (value: string): Uint8Array => {
    let std = value.replace(/-/g, '+').replace(/_/g, '/')
    const remainder = std.length % 4
    if (remainder === 1) {
        throw new Error(`Invalid base64url length: ${value.length}`)
    }
    if (remainder === 2) std += '=='
    else if (remainder === 3) std += '='
    return decodeFromBase64(std)
}

/** Normalizes a WebAuthn `BufferSource` (`ArrayBuffer | ArrayBufferView`) to a `Uint8Array` view (passed through unchanged if already one). */
export const bufferSourceToBytes = (input: BufferSource): Uint8Array => {
    if (input instanceof Uint8Array) return input
    return ArrayBuffer.isView(input)
        ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
        : new Uint8Array(input)
}

/** Copies `bytes` into a freshly-sized `ArrayBuffer` (no shared backing, no slack). */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer

export type SerializedPublicKeyCredentialDescriptor = {
    type: 'public-key'
    id: string
    transports?: AuthenticatorTransport[]
}

export type SerializedCreateOptions = {
    rp: PublicKeyCredentialRpEntity
    user: {
        id: string
        name: string
        displayName: string
    }
    challenge: string
    pubKeyCredParams: PublicKeyCredentialParameters[]
    timeout?: number
    excludeCredentials?: SerializedPublicKeyCredentialDescriptor[]
    authenticatorSelection?: AuthenticatorSelectionCriteria
    attestation?: AttestationConveyancePreference
    extensions?: AuthenticationExtensionsClientInputs
}

export type SerializedGetOptions = {
    challenge: string
    timeout?: number
    rpId?: string
    allowCredentials?: SerializedPublicKeyCredentialDescriptor[]
    userVerification?: UserVerificationRequirement
    extensions?: AuthenticationExtensionsClientInputs
}

export type SerializedAttestationResponse = {
    clientDataJSON: string
    attestationObject: string
}

export type SerializedAssertionResponse = {
    clientDataJSON: string
    authenticatorData: string
    signature: string
    userHandle: string | null
}

export type SerializedCredential = {
    id: string
    rawId: string
    type: 'public-key'
    response: SerializedAttestationResponse | SerializedAssertionResponse
}

/** In-memory (real `ArrayBuffer`-bearing) counterpart of {@link SerializedCredential}. */
export type RawCredential = {
    /** Credential id bytes; `id`/`rawId` in the wire form are both derived from this. */
    id: Uint8Array
    type: 'public-key'
    response: RawAttestationResponse | RawAssertionResponse
}

export type RawAttestationResponse = {
    clientDataJSON: Uint8Array
    attestationObject: Uint8Array
}

export type RawAssertionResponse = {
    clientDataJSON: Uint8Array
    authenticatorData: Uint8Array
    signature: Uint8Array
    userHandle: Uint8Array | null
}

const isRawAssertionResponse = (
    response: RawAttestationResponse | RawAssertionResponse,
): response is RawAssertionResponse => 'authenticatorData' in response

const isSerializedAssertionResponse = (
    response: SerializedAttestationResponse | SerializedAssertionResponse,
): response is SerializedAssertionResponse => 'authenticatorData' in response

const serializeDescriptor = (
    descriptor: PublicKeyCredentialDescriptor,
): SerializedPublicKeyCredentialDescriptor => ({
    type: 'public-key',
    id: bytesToB64url(bufferSourceToBytes(descriptor.id)),
    ...(descriptor.transports ? { transports: descriptor.transports } : {}),
})

const deserializeDescriptor = (
    descriptor: SerializedPublicKeyCredentialDescriptor,
): PublicKeyCredentialDescriptor => ({
    type: 'public-key',
    id: toArrayBuffer(b64urlToBytes(descriptor.id)),
    ...(descriptor.transports ? { transports: descriptor.transports } : {}),
})

/** Converts `PublicKeyCredentialCreationOptions` (as passed to `navigator.credentials.create`) to its JSON-safe wire shape. */
export const serializeCreateOptions = (
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

/** Reconstructs `PublicKeyCredentialCreationOptions` from the wire shape. */
export const deserializeCreateOptions = (
    serialized: SerializedCreateOptions,
): PublicKeyCredentialCreationOptions => ({
    rp: serialized.rp,
    user: {
        id: toArrayBuffer(b64urlToBytes(serialized.user.id)),
        name: serialized.user.name,
        displayName: serialized.user.displayName,
    },
    challenge: toArrayBuffer(b64urlToBytes(serialized.challenge)),
    pubKeyCredParams: serialized.pubKeyCredParams,
    ...(serialized.timeout !== undefined
        ? { timeout: serialized.timeout }
        : {}),
    ...(serialized.excludeCredentials
        ? {
              excludeCredentials: serialized.excludeCredentials.map(
                  deserializeDescriptor,
              ),
          }
        : {}),
    ...(serialized.authenticatorSelection
        ? { authenticatorSelection: serialized.authenticatorSelection }
        : {}),
    ...(serialized.attestation ? { attestation: serialized.attestation } : {}),
    ...(serialized.extensions ? { extensions: serialized.extensions } : {}),
})

/** Converts `PublicKeyCredentialRequestOptions` (as passed to `navigator.credentials.get`) to its JSON-safe wire shape. */
export const serializeGetOptions = (
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

/** Reconstructs `PublicKeyCredentialRequestOptions` from the wire shape. */
export const deserializeGetOptions = (
    serialized: SerializedGetOptions,
): PublicKeyCredentialRequestOptions => ({
    challenge: toArrayBuffer(b64urlToBytes(serialized.challenge)),
    ...(serialized.timeout !== undefined
        ? { timeout: serialized.timeout }
        : {}),
    ...(serialized.rpId ? { rpId: serialized.rpId } : {}),
    ...(serialized.allowCredentials
        ? {
              allowCredentials: serialized.allowCredentials.map(
                  deserializeDescriptor,
              ),
          }
        : {}),
    ...(serialized.userVerification
        ? { userVerification: serialized.userVerification }
        : {}),
    ...(serialized.extensions ? { extensions: serialized.extensions } : {}),
})

/** Converts an in-memory credential (real bytes) to its JSON-safe wire shape. */
export const serializeCredential = (
    raw: RawCredential,
): SerializedCredential => {
    const id = bytesToB64url(raw.id)
    return {
        id,
        rawId: id,
        type: 'public-key',
        response: isRawAssertionResponse(raw.response)
            ? {
                  clientDataJSON: bytesToB64url(raw.response.clientDataJSON),
                  authenticatorData: bytesToB64url(
                      raw.response.authenticatorData,
                  ),
                  signature: bytesToB64url(raw.response.signature),
                  userHandle: raw.response.userHandle
                      ? bytesToB64url(raw.response.userHandle)
                      : null,
              }
            : {
                  clientDataJSON: bytesToB64url(raw.response.clientDataJSON),
                  attestationObject: bytesToB64url(
                      raw.response.attestationObject,
                  ),
              },
    }
}

/** Reconstructs an in-memory credential (real bytes) from the wire shape. */
export const deserializeCredential = (
    serialized: SerializedCredential,
): RawCredential => ({
    id: b64urlToBytes(serialized.id),
    type: 'public-key',
    response: isSerializedAssertionResponse(serialized.response)
        ? {
              clientDataJSON: b64urlToBytes(serialized.response.clientDataJSON),
              authenticatorData: b64urlToBytes(
                  serialized.response.authenticatorData,
              ),
              signature: b64urlToBytes(serialized.response.signature),
              userHandle: serialized.response.userHandle
                  ? b64urlToBytes(serialized.response.userHandle)
                  : null,
          }
        : {
              clientDataJSON: b64urlToBytes(serialized.response.clientDataJSON),
              attestationObject: b64urlToBytes(
                  serialized.response.attestationObject,
              ),
          },
})
