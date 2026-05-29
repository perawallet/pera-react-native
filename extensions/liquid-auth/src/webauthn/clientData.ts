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

import { toBase64Url } from './base64url'

export type ClientDataType = 'webauthn.create' | 'webauthn.get'

export type ClientDataOptions = {
    type: ClientDataType
    /** Raw challenge bytes; serialized as base64url. */
    challenge: Uint8Array
    origin: string
    crossOrigin?: boolean
}

export type ClientData = {
    json: string
    bytes: Uint8Array
}

/**
 * Build the WebAuthn clientDataJSON. Keys are emitted in the conventional
 * order (type, challenge, origin, crossOrigin) and the result is UTF-8 encoded.
 */
export const buildClientDataJSON = (opts: ClientDataOptions): ClientData => {
    const payload = {
        type: opts.type,
        challenge: toBase64Url(opts.challenge),
        origin: opts.origin,
        crossOrigin: opts.crossOrigin ?? false,
    }
    const json = JSON.stringify(payload)
    return { json, bytes: new TextEncoder().encode(json) }
}
