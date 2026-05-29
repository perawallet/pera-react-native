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

import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import {
    ARC0027_ERROR_CODES,
    ARC0027_NAMESPACE,
    type Arc0027Method,
    type Arc0027Reference,
    type Arc0027RequestEnvelope,
} from './types'
import { Arc0027Error } from './errors'
import { cborDecode, cborEncode } from './cbor'

// uuidv4 (runtime use — Math.random is fine here; this is not a workflow script).
const uuidv4 = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })

/**
 * Data-channel wire framing. dApps send ARC-0027 envelopes as CBOR, base64'd,
 * over the WebRTC data channel (a text frame) — NOT JSON. These two functions
 * are the only place that knows the wire format; everything else works with
 * plain envelope objects.
 */
export const encodeFrame = (value: unknown): string =>
    encodeToBase64(cborEncode(value))

export const decodeFrame = (raw: string): unknown => {
    // Tolerate base64url just in case (normalize to standard base64).
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
    return cborDecode(decodeFromBase64(normalized))
}

export const parseReference = (
    reference: string,
): { method: Arc0027Method; type: 'request' | 'response' } => {
    const [namespace, method, type] = reference.split(':')
    if (
        namespace !== ARC0027_NAMESPACE ||
        (type !== 'request' && type !== 'response')
    ) {
        throw new Arc0027Error(
            ARC0027_ERROR_CODES.InvalidInputError,
            `Unsupported reference: ${reference}`,
        )
    }
    return { method: method as Arc0027Method, type }
}

export const parseEnvelope = (raw: string): Arc0027RequestEnvelope => {
    let parsed: unknown
    try {
        parsed = decodeFrame(raw)
    } catch {
        throw new Arc0027Error(
            ARC0027_ERROR_CODES.InvalidInputError,
            'Malformed ARC-0027 message',
        )
    }
    const env = parsed as Partial<Arc0027RequestEnvelope>
    if (
        !env ||
        typeof env.id !== 'string' ||
        typeof env.reference !== 'string'
    ) {
        throw new Arc0027Error(
            ARC0027_ERROR_CODES.InvalidInputError,
            'Missing id/reference',
        )
    }
    parseReference(env.reference)
    return env as Arc0027RequestEnvelope
}

const responseReference = (method: Arc0027Method): Arc0027Reference =>
    `${ARC0027_NAMESPACE}:${method}:response`

export const buildResponse = (
    requestId: string,
    method: Arc0027Method,
    result: Record<string, unknown>,
): string =>
    encodeFrame({
        id: uuidv4(),
        reference: responseReference(method),
        requestId,
        result,
    })

export const buildErrorResponse = (
    requestId: string,
    method: Arc0027Method,
    error: Arc0027Error,
): string =>
    encodeFrame({
        id: uuidv4(),
        reference: responseReference(method),
        requestId,
        error: { code: error.code, message: error.message, data: error.data },
    })
