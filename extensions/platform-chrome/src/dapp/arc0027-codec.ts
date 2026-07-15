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
    ARC0027_NAMESPACE,
    type Arc0027Method,
    type Arc0027Reference,
    type Arc0027RequestEnvelope,
    type Arc0027ResponseEnvelope,
} from './arc0027-types'

// Exhaustive over Arc0027Method — a new union member fails to typecheck here
// until it's added, so isMethod() can never silently drift from the type.
const ARC0027_METHOD_SET = {
    discover: true,
    enable: true,
    disable: true,
    sign_transactions: true,
    post_transactions: true,
    sign_and_post_transactions: true,
    sign_message: true,
} satisfies Record<Arc0027Method, true>

const isMethod = (value: string): value is Arc0027Method =>
    Object.prototype.hasOwnProperty.call(ARC0027_METHOD_SET, value)

export const parseReference = (
    reference: string,
): { method: Arc0027Method; type: 'request' | 'response' } | null => {
    const parts = reference.split(':')
    if (parts.length !== 3) return null
    const [namespace, method, type] = parts
    if (namespace !== ARC0027_NAMESPACE) return null
    if (!isMethod(method)) return null
    if (type !== 'request' && type !== 'response') return null
    return { method, type }
}

export const isArc0027Request = (
    value: unknown,
): value is Arc0027RequestEnvelope => {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    if (typeof v.id !== 'string' || typeof v.reference !== 'string')
        return false
    const parsed = parseReference(v.reference)
    return parsed !== null && parsed.type === 'request'
}

// Response ids are fresh (crypto.randomUUID) so a response is never confused
// with the request it answers; correlation is via `requestId`.
const freshId = (): string => globalThis.crypto.randomUUID()

const toResponseReference = (
    request: Arc0027RequestEnvelope,
): Arc0027Reference => {
    const parsed = parseReference(request.reference)
    // Callers only pass envelopes that already passed isArc0027Request.
    return `${ARC0027_NAMESPACE}:${parsed!.method}:response`
}

export const buildResponse = (
    request: Arc0027RequestEnvelope,
    result: Record<string, unknown>,
): Arc0027ResponseEnvelope => ({
    id: freshId(),
    requestId: request.id,
    reference: toResponseReference(request),
    result,
})

export const buildErrorResponse = (
    request: Arc0027RequestEnvelope,
    error: { code: number; message: string; data?: unknown },
): Arc0027ResponseEnvelope => ({
    id: freshId(),
    requestId: request.id,
    reference: toResponseReference(request),
    error,
})
