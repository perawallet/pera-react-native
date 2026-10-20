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

import { isHTTPError } from 'ky'
import { AppError, ErrorCategory, ErrorSeverity } from './base'

const INTEGRITY_CODE_PREFIX = 'APP_INTEGRITY_'

type IntegrityRefusal = {
    /** The backend's `APP_INTEGRITY_*` code; null when it sent none (a bare 401). */
    code: string | null
    status: number
    /** The refused request carried a bearer: the backend turned down a token this realm held. */
    hadToken: boolean
    /** Epoch ms from the refused bearer's `exp` claim, naming which token was refused; null when unreadable. */
    tokenExpiresAt?: number | null
}

/**
 * A Pera request refused for want of a valid integrity token, which is the
 * extension's only credential. Clears once the service worker holds a token
 * again, so it is expected and retryable rather than a defect.
 */
export class IntegrityRequiredError extends AppError {
    public readonly code: string | null
    public readonly status: number
    public readonly hadToken: boolean
    public readonly tokenExpiresAt: number | null

    constructor(
        { code, status, hadToken, tokenExpiresAt = null }: IntegrityRefusal,
        originalError?: Error,
    ) {
        super(
            `[integrity] ${status} ${code ?? 'no valid credential'}`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.NETWORK,
                retryable: true,
                expected: true,
                titleKey: 'errors.integrity.unavailable.title',
                messageKey: 'errors.integrity.unavailable.body',
            },
            originalError,
        )
        this.code = code
        this.status = status
        this.hadToken = hadToken
        this.tokenExpiresAt = tokenExpiresAt
    }
}

export const isIntegrityRequiredError = (
    error: unknown,
): error is IntegrityRequiredError => error instanceof IntegrityRequiredError

// The claim is read, never trusted: it only names which token the backend
// refused, so the worker replaces that token and no newer one.
const readBearerExpiry = (bearer: string): number | null => {
    try {
        const payload = bearer.split('.')[1]
        if (!payload) return null
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        const exp = (JSON.parse(json) as { exp?: unknown }).exp
        return typeof exp === 'number' ? exp * 1000 : null
    } catch {
        return null
    }
}

/**
 * The integrity refusal a Pera backend HTTP error stands for, or null. Only a
 * request that carried no API key can be one: a keyed request is native's, and
 * its guarded routes answer with these codes for their own integrity header.
 * Then a 401 or 403 with an `APP_INTEGRITY_*` code, or any 401, is a refusal;
 * a codeless 403 (geo, permissions) keeps its own meaning. Only for the Pera
 * backend: the backup service answers 401 for its own signed-request checks.
 */
export const toIntegrityRequiredError = (
    error: unknown,
): IntegrityRequiredError | null => {
    if (!isHTTPError(error)) return null
    const status = error.response?.status
    if (status !== 401 && status !== 403) return null

    const body = error.data as { code?: unknown } | null | undefined
    const code =
        typeof body?.code === 'string' &&
        body.code.startsWith(INTEGRITY_CODE_PREFIX)
            ? body.code
            : null
    const headers = error.request?.headers
    if (headers?.has('X-API-Key')) return null
    const authorization = headers?.get('Authorization') ?? ''
    const hadToken = authorization.startsWith('Bearer ')

    if (code === null && status !== 401) return null
    return new IntegrityRequiredError(
        {
            code,
            status,
            hadToken,
            tokenExpiresAt: hadToken
                ? readBearerExpiry(authorization.slice('Bearer '.length))
                : null,
        },
        error,
    )
}
