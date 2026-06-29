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

import { LogicError } from '@algorandfoundation/algokit-utils/types/logic-error'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AlgodError } from './AlgodError'
import { parseAlgodMessage } from './parseAlgodMessage'

/**
 * Converts any error thrown from algokit-utils / algosdk / the algod node into
 * a structured {@link AlgodError}. Idempotent: passing an existing AlgodError
 * returns it unchanged. Never throws.
 */
export const toAlgodError = (err: unknown): AlgodError => {
    if (err instanceof AlgodError) return err
    if (err instanceof LogicError) return fromLogicError(err)

    const maybeError = err instanceof Error ? err : undefined

    if (maybeError && isApiErrorLike(err)) return fromApiError(err, maybeError)
    if (maybeError && isFetchTypeError(maybeError)) {
        return new AlgodError('network_unavailable', {}, maybeError)
    }

    if (maybeError) {
        const parsed = parseAlgodMessage(maybeError.message)
        if (parsed) {
            return new AlgodError(
                parsed.code,
                parsed.params as never,
                maybeError,
            )
        }
        return new AlgodError(
            'unknown_node_error',
            { raw: maybeError.message || String(maybeError) },
            maybeError,
        )
    }

    return new AlgodError('unknown_node_error', { raw: stringifyUnknown(err) })
}

const fromLogicError = (err: LogicError): AlgodError<'logic_error'> =>
    new AlgodError(
        'logic_error',
        {
            txId: err.led?.txId,
            pc: err.led?.pc,
            msg: err.led?.msg ?? err.message,
            tealLine: err.teal_line,
        },
        err,
    )

// algokit's ApiError is not publicly exported. Duck-type on the three fields
// we care about so we don't couple to an internal import path.
interface ApiErrorLike {
    status: number
    url: string
    body?: unknown
}

const isApiErrorLike = (err: unknown): err is ApiErrorLike & Error => {
    if (!(err instanceof Error)) return false
    const candidate = err as Partial<ApiErrorLike>
    return (
        typeof candidate.status === 'number' &&
        typeof candidate.url === 'string'
    )
}

const fromApiError = (err: ApiErrorLike, cause: Error): AlgodError => {
    // 4xx responses often carry a node error in `body.message` — try to parse
    // it before falling back to the transport-level code.
    const bodyMessage = extractBodyMessage(err.body)
    if (bodyMessage) {
        const parsed = parseAlgodMessage(bodyMessage)
        if (parsed) {
            return new AlgodError(parsed.code, parsed.params as never, cause)
        }
    }

    if (err.status >= 500 || err.status === 0) {
        return new AlgodError(
            'network_unavailable',
            { status: err.status, url: err.url },
            cause,
        )
    }

    return new AlgodError(
        'unknown_node_error',
        { raw: bodyMessage ?? `${err.status} ${err.url}` },
        cause,
    )
}

const extractBodyMessage = (body: unknown): Optional<string> => {
    if (typeof body === 'string') return body
    if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message?: unknown }).message
        if (typeof m === 'string') return m
    }
    return undefined
}

// Catches React Native's `TypeError: Network request failed` and Node's
// `fetch failed` style errors that don't carry a status code.
const isFetchTypeError = (err: Error): boolean => {
    if (!(err instanceof TypeError)) return false
    const m = err.message.toLowerCase()
    return (
        m.includes('network request failed') ||
        m.includes('fetch failed') ||
        m.includes('failed to fetch')
    )
}

const stringifyUnknown = (err: unknown): string => {
    if (err === undefined) return 'undefined'
    if (err === null) return 'null'
    try {
        return typeof err === 'string' ? err : JSON.stringify(err)
    } catch {
        return String(err)
    }
}
