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

import { sha256 } from '@noble/hashes/sha2.js'
import { concatBytes, decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60FailedDecodingError,
    Arc60InvalidDateError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
    Arc60MissingAuthDataError,
    Arc60MissingDomainError,
} from './arc60-errors'
import { parseSiwa } from './siwa'
import type { Arc60Metadata, Arc60StdSigData } from '../pipeline/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// Re-export the ARC-60 error catalogue so existing `../utils/arc60` imports
// keep working. The classes live in `./arc60-errors` to avoid an import cycle
// with the SIWA parser.
export * from './arc60-errors'

/**
 * ARC-60 scope value for `AUTH` (the only scope defined by the spec today).
 */
export const ARC60_SCOPE_AUTH = 1

/**
 * Encodings the wallet currently understands for ARC-60 `data`.
 */
export const ARC60_SUPPORTED_ENCODINGS = ['base64'] as const
export type Arc60SupportedEncoding = (typeof ARC60_SUPPORTED_ENCODINGS)[number]

/**
 * Decodes the ARC-60 `data` field per `metadata.encoding`.
 *
 * Only `base64` is supported in v1. Unknown encodings throw
 * {@link Arc60FailedDecodingError}.
 */
export const decodeArc60Data = (data: string, encoding: string): Uint8Array => {
    if (encoding !== 'base64') {
        throw new Arc60FailedDecodingError(encoding)
    }
    try {
        return decodeFromBase64(data)
    } catch (error) {
        throw new Arc60FailedDecodingError(
            encoding,
            error instanceof Error ? error : undefined,
        )
    }
}

/**
 * Verifies the ARC-60 spec-required invariant
 * `authenticatorData[0:32] === sha256(utf8(domain))`.
 *
 * Throws {@link Arc60DomainMismatchError} on mismatch and
 * {@link Arc60MissingAuthDataError} when `authenticatorData` is too short.
 */
export const verifyAuthenticatorDomain = (
    domain: string,
    authenticatorData: Uint8Array,
): void => {
    if (!domain) {
        throw new Arc60MissingDomainError()
    }
    if (!authenticatorData || authenticatorData.length < 32) {
        throw new Arc60MissingAuthDataError()
    }
    const expected = sha256(new TextEncoder().encode(domain))
    // Constant-time compare over the 32-byte rpIdHash prefix.
    let diff = 0
    for (let i = 0; i < 32; i++) {
        diff |= expected[i] ^ authenticatorData[i]
    }
    if (diff !== 0) {
        throw new Arc60DomainMismatchError(domain)
    }
}

/**
 * Builds the ARC-60 AUTH-scope signing payload:
 *
 * ```text
 *     payload = sha256(decodedData) || sha256(authenticatorData)
 * ```
 *
 * 64 bytes total — two concatenated SHA-256 digests. Matches Lute's
 * reference implementation so signatures are interop-compatible. The
 * legacy Algorand `"MX"` arbitrary-data prefix is **not** prepended —
 * domain separation is provided by `authenticatorData[0:32] == sha256(domain)`.
 */
export const buildArc60AuthSigningPayload = (
    decodedData: Uint8Array,
    authenticatorData: Uint8Array,
): Uint8Array => concatBytes(sha256(decodedData), sha256(authenticatorData))

/**
 * The SIWA schema's ISO check allows fractional-second precision outside the
 * ES Date Time String Format, so `Date.parse` can still return `NaN` here —
 * a bare comparison would silently fail open.
 */
export const parseArc60Timestamp = (
    value: string | undefined,
): number | undefined => {
    if (value === undefined) {
        return undefined
    }
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
        throw new Arc60InvalidDateError(`unparseable timestamp "${value}"`)
    }
    return parsed
}

/**
 * Runs the full host-side ARC-60 AUTH validation shared by the local-key and
 * hardware-wallet signing paths: scope check, domain binding, base64 decode,
 * UTF-8 + canonical SIWA parse, and signer/domain cross-checks against the
 * SIWA payload. Returns the decoded data so callers can build the signing
 * payload (local key) or forward it to the device (hardware).
 *
 * Throws spec-aligned `Arc60*Error`s for every rejection path. Does NOT check
 * the `hdPath` — that is account-type specific and stays with the caller.
 */
export const validateArc60AuthRequest = (
    stdSigData: Arc60StdSigData,
    metadata: Arc60Metadata,
    accounts: WalletAccount[],
): { decodedData: Uint8Array } => {
    if (metadata.scope !== ARC60_SCOPE_AUTH) {
        throw new Arc60InvalidScopeError(metadata.scope)
    }

    verifyAuthenticatorDomain(stdSigData.domain, stdSigData.authenticatorData)

    const decodedData = decodeArc60Data(stdSigData.data, metadata.encoding)

    let jsonString: string
    try {
        jsonString = new TextDecoder('utf-8', { fatal: true }).decode(
            decodedData,
        )
    } catch (caught) {
        throw new Arc60BadJsonError(
            'decoded payload is not valid UTF-8',
            caught instanceof Error ? caught : undefined,
        )
    }

    const siwa = parseSiwa(jsonString)

    const issuedAt = parseArc60Timestamp(siwa['issued-at'])
    const notBefore = parseArc60Timestamp(siwa['not-before'])
    const expirationTime = parseArc60Timestamp(siwa['expiration-time'])
    const now = Date.now()

    if (
        (issuedAt !== undefined && issuedAt > now) ||
        (notBefore !== undefined && notBefore > now) ||
        (expirationTime !== undefined && expirationTime <= now)
    ) {
        throw new Arc60InvalidDateError(
            `SIWA issued-at, not-before or expiration-date is invalid`,
        )
    }

    if (siwa.domain !== stdSigData.domain) {
        throw new Arc60BadJsonError(
            `SIWA domain "${siwa.domain}" does not match request domain "${stdSigData.domain}"`,
        )
    }
    if (siwa.account_address !== stdSigData.signer) {
        if (
            !accounts.find(
                a =>
                    a.address === siwa.account_address &&
                    a.rekeyAddress === stdSigData.signer,
            )
        ) {
            throw new Arc60InvalidSignerError(
                stdSigData.signer,
                `SIWA signer is not a valid signer for "${siwa.account_address}"`,
            )
        }
    }

    return { decodedData }
}
