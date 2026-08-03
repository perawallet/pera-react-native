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
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

// Aligned with the ARC-60 error catalogue so the WalletConnect bridge can
// surface spec-conformant rejection reasons. Kept in their own module so the
// SIWA parser can throw `Arc60BadJsonError` without creating an import cycle
// with `arc60.ts` (which depends on the SIWA parser).

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

/** ERROR_INVALID_DATE — One of the dates in the payload is not valid / canonical SIWA JSON. */
export class Arc60InvalidDateError extends AppError {
    constructor(reason: string, originalError?: Error) {
        super(
            `ARC-60 date is not a valid for canonical SIWA JSON: ${reason}`,
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

/**
 * ERROR_INVALID_INPUT — the request's wire shape or size is malformed, before
 * any SIWA-level parsing (bad field types, oversized payload, non-base64
 * `authenticatorData`). Distinct from {@link Arc60BadJsonError}, which is
 * specifically about the decoded AUTH SIWA payload.
 */
export class Arc60BadRequestError extends AppError {
    constructor(reason: string, originalError?: Error) {
        super(
            `ARC-60 sign request is invalid: ${reason}`,
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
