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

import { isHTTPError, isTimeoutError, type BeforeErrorState } from 'ky'
import {
    isNetworkTransportError,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { BAANX_CORRELATION_ID_HEADER } from './baanx-headers'

const MAX_BAANX_MESSAGE_LENGTH = 200

// Statuses the card flows expect and handle: form validation (400, 422), an
// expired session or wrong credentials (401), and "no card or user yet" (404).
// Anything else, a 403 included, is worth a report.
const FLOW_STATUSES = new Set([400, 401, 404, 422])

// Path only: query strings on onboarding calls can carry the user's email.
const pathOf = (url: Optional<string>): Optional<string> => {
    if (!url) return undefined
    try {
        return new URL(url).pathname
    } catch {
        return undefined
    }
}

const baanxMessageOf = (data: unknown): Optional<string> => {
    const message = (data as Optional<{ message?: unknown }>)?.message
    return typeof message === 'string'
        ? message.slice(0, MAX_BAANX_MESSAGE_LENGTH)
        : undefined
}

/** ky `beforeError` hook for direct Baanx calls, which bypass the shared client's logging. */
export const logBaanxRequestError = ({
    request,
    error,
}: BeforeErrorState): Error => {
    if (error.name === 'AbortError') return error

    const requestContext = {
        method: request?.method,
        path: pathOf(request?.url),
    }

    if (isTimeoutError(error) || isNetworkTransportError(error)) {
        logger.warn('Baanx request did not complete', {
            ...requestContext,
            name: error.name,
        })
        return error
    }

    if (!isHTTPError(error)) return error

    const status = error.response.status
    const context = {
        ...requestContext,
        status,
        correlationId:
            error.response.headers.get(BAANX_CORRELATION_ID_HEADER) ??
            undefined,
        baanxMessage: baanxMessageOf(error.data),
    }

    if (FLOW_STATUSES.has(status)) {
        logger.warn('Baanx request rejected', context)
    } else {
        logger.error('Baanx request failed', context)
    }
    return error
}
