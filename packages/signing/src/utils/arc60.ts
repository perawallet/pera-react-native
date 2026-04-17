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
    AppError,
    ErrorCategory,
    ErrorSeverity,
    concatBytes,
    decodeFromBase64,
} from '@perawallet/wallet-core-shared'

/**
 * ARC-60 scope value for `AUTH` (the only scope defined by the spec today).
 */
export const ARC60_SCOPE_AUTH = 1

/**
 * Encodings the wallet currently understands for ARC-60 `data`.
 */
export const ARC60_SUPPORTED_ENCODINGS = ['base64'] as const
export type Arc60SupportedEncoding = (typeof ARC60_SUPPORTED_ENCODINGS)[number]

// =============================================================================
// Errors
// =============================================================================
//
// Aligned with the ARC-60 error catalogue so the WalletConnect bridge can
// surface spec-conformant rejection reasons.

/** ERROR_INVALID_SCOPE — scope value not recognised by the wallet. */
export class Arc60InvalidScopeError extends AppError {
    constructor(scope: number) {
        super(`ARC-60 scope ${scope} is not supported`, {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            recoverable: false,
            params: { scope },
        })
    }
}

/** ERROR_FAILED_DECODING — `data` could not be decoded per `metadata.encoding`. */
export class Arc60FailedDecodingError extends AppError {
    constructor(encoding: string, originalError?: Error) {
        super(
            `Failed to decode ARC-60 data using encoding "${encoding}"`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.VALIDATION,
                recoverable: false,
                params: { encoding },
            },
            originalError,
        )
    }
}

/** ERROR_INVALID_SIGNER — signer not in the wallet (or not signable). */
export class Arc60InvalidSignerError extends AppError {
    constructor(signer: string, reason?: string) {
        super(
            reason
                ? `ARC-60 signer ${signer} is invalid: ${reason}`
                : `ARC-60 signer ${signer} is not available in this wallet`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.VALIDATION,
                recoverable: false,
                params: { signer, reason },
            },
        )
    }
}

/** ERROR_MISSING_DOMAIN — `domain` field absent from request. */
export class Arc60MissingDomainError extends AppError {
    constructor() {
        super('ARC-60 request is missing required `domain` field', {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            recoverable: false,
        })
    }
}

/** ERROR_MISSING_AUTHENTICATED_DATA — `authenticatorData` absent from request. */
export class Arc60MissingAuthDataError extends AppError {
    constructor() {
        super('ARC-60 request is missing required `authenticatorData` field', {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            recoverable: false,
        })
    }
}

/** ERROR_BAD_JSON — AUTH-scope payload is not valid / canonical SIWA JSON. */
export class Arc60BadJsonError extends AppError {
    constructor(reason: string, originalError?: Error) {
        super(
            `ARC-60 AUTH payload is not a valid canonical SIWA JSON: ${reason}`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.VALIDATION,
                recoverable: false,
                params: { reason },
            },
            originalError,
        )
    }
}

/** ERROR_FAILED_DOMAIN_AUTH — `authenticatorData[0:32]` ≠ sha256(domain). */
export class Arc60DomainMismatchError extends AppError {
    constructor(domain: string) {
        super(
            `ARC-60 authenticatorData rpIdHash does not match sha256(${domain})`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.VALIDATION,
                recoverable: false,
                params: { domain },
            },
        )
    }
}

/** ERROR_FAILED_HD_PATH — provided `hdPath` is invalid or doesn't match the signer. */
export class Arc60FailedHdPathError extends AppError {
    constructor(hdPath: string, reason?: string) {
        super(
            reason
                ? `ARC-60 hdPath "${hdPath}" is invalid: ${reason}`
                : `ARC-60 hdPath "${hdPath}" is invalid`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.VALIDATION,
                recoverable: false,
                params: { hdPath, reason },
            },
        )
    }
}

// =============================================================================
// Crypto / payload helpers
// =============================================================================

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
