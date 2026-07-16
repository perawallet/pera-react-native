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

import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { encodeToBase64, toUrlSafeBase64 } from '@perawallet/wallet-core-shared'

/**
 * PKCE material for one OAuth attempt (RFC 7636). The verifier stays on this
 * device until the token exchange; only the challenge travels with the
 * authorization request.
 */
export type PkcePair = {
    /** 43 base64url chars — within the spec's 43–128 unreserved-charset range. */
    codeVerifier: string
    /** BASE64URL(SHA256(ASCII(codeVerifier))), method S256. */
    codeChallenge: string
}

// Unpadded base64url — Baanx validates against [A-Za-z0-9_-] with no '='.
const bytesToBase64Url = (bytes: Uint8Array): string =>
    toUrlSafeBase64(encodeToBase64(bytes))

const randomBase64Url = (byteLength: number): string => {
    const bytes = new Uint8Array(byteLength)
    crypto.getRandomValues(bytes)
    return bytesToBase64Url(bytes)
}

/** S256 challenge for a given verifier — split out for known-answer tests. */
export const createCodeChallenge = (codeVerifier: string): string =>
    bytesToBase64Url(sha256(utf8ToBytes(codeVerifier)))

/** Fresh verifier + S256 challenge from 32 CSPRNG bytes. One per login attempt. */
export const createPkcePair = (): PkcePair => {
    const codeVerifier = randomBase64Url(32)
    return { codeVerifier, codeChallenge: createCodeChallenge(codeVerifier) }
}

/**
 * CSRF `state` for the authorize round-trip (Baanx requires ≥ 8 chars). The
 * value echoed back by /v1/auth/oauth/authorize must equal this original.
 */
export const createOauthState = (): string => randomBase64Url(16)
