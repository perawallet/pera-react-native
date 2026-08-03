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

import { z } from 'zod'
import {
    decodeFromBase64,
    utf8ByteLength,
} from '@perawallet/wallet-core-shared'
import type { Arc60Metadata, Arc60StdSigData } from '../pipeline/types'
import { Arc60BadRequestError } from './arc60-errors'

// Single source of truth for the on-the-wire shape of an ARC-60 sign request,
// shared by every transport that accepts one (WalletConnect bridge + the
// in-app webview bridge). Keep the schema and limits here — do not re-declare
// them per transport, or the two paths will drift.

/**
 * Hard cap on the serialized size of an ARC-60 `algo_signData` request.
 * ARC-60 is the primary untrusted-dApp input surface; oversized payloads are
 * rejected *before* parse/canonify to keep the signing UI thread responsive.
 */
export const ARC60_MAX_REQUEST_BYTES = 64 * 1024

/**
 * Rejects an ARC-60 request whose serialized size exceeds
 * {@link ARC60_MAX_REQUEST_BYTES} *before* it reaches `safeParse`/`canonify`.
 * Pure + dependency-free so it can be unit-tested without a transport stack.
 */
export const assertArc60RequestWithinLimits = (rawParams: unknown): void => {
    const serialized = JSON.stringify(rawParams) ?? ''
    if (utf8ByteLength(serialized) > ARC60_MAX_REQUEST_BYTES) {
        throw new Arc60BadRequestError(
            'request exceeds the maximum allowed size',
        )
    }
}

/**
 * Zod schema for the wire shape of an ARC-60 `algo_signData` request.
 *
 * Mirrors ARC-60's `StdSigData` + `Metadata`. `data`, `signer`, `domain`,
 * `authenticatorData` are required strings on the wire; `authenticatorData`
 * is base64 and is decoded after parsing.
 */
export const arc60WireSchema = z.object({
    data: z.string().max(16 * 1024), // base64-encoded SIWA blob
    signer: z.string().min(1).max(128),
    domain: z.string().min(1).max(256),
    authenticatorData: z.string().min(1).max(512),
    requestId: z.string().max(256).optional(),
    hdPath: z.string().max(256).optional(),
    metadata: z.object({
        scope: z.number().int(),
        encoding: z.string().min(1).max(32),
    }),
})

export type Arc60WireRequest = z.infer<typeof arc60WireSchema>

/**
 * Discriminates an ARC-60 (`StdSigData` + `Metadata`) payload from the legacy
 * arbitrary-data shape. ARC-60 arrives as a single object carrying either an
 * `authenticatorData` field or `metadata.scope`; detect on either so a dApp
 * that omits one signal doesn't slip through to the legacy path.
 */
export const isArc60WirePayload = (params: unknown): boolean => {
    if (params == null || typeof params !== 'object' || Array.isArray(params)) {
        return false
    }
    const candidate = params as {
        authenticatorData?: unknown
        metadata?: { scope?: unknown }
    }
    return (
        candidate.authenticatorData != null || candidate.metadata?.scope != null
    )
}

/**
 * Validates raw ARC-60 request params against {@link arc60WireSchema} and the
 * size cap, then base64-decodes `authenticatorData`. Returns the typed
 * `Arc60StdSigData` / `Arc60Metadata` ready for the signing pipeline. Throws
 * {@link Arc60BadRequestError} on any wire-level problem. Does NOT perform
 * signer/session checks — those are transport-specific.
 */
export const parseArc60WireRequest = (
    rawParams: unknown,
): { stdSigData: Arc60StdSigData; metadata: Arc60Metadata } => {
    assertArc60RequestWithinLimits(rawParams)

    const parsed = arc60WireSchema.safeParse(rawParams)
    if (!parsed.success) {
        const summary = parsed.error.issues
            .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; ')
        throw new Arc60BadRequestError(summary)
    }

    const {
        data,
        signer,
        domain,
        authenticatorData,
        requestId,
        hdPath,
        metadata,
    } = parsed.data

    let decodedAuthData: Uint8Array
    try {
        decodedAuthData = decodeFromBase64(authenticatorData)
    } catch (decodeError) {
        throw new Arc60BadRequestError(
            '`authenticatorData` is not valid base64',
            decodeError instanceof Error ? decodeError : undefined,
        )
    }

    return {
        stdSigData: {
            data,
            signer,
            domain,
            authenticatorData: decodedAuthData,
            requestId,
            hdPath,
        },
        metadata,
    }
}

const hostFromMaybeUrl = (value: string): string => {
    const trimmed = value.trim().toLowerCase()
    // A bare authority with a port ("arc60.io:8080" — the SIWA `domain`
    // shape) parses as a URL with the host in the *scheme* position and an
    // empty host, so prefix a scheme unless the value clearly carries one.
    const candidate = trimmed.includes('//') ? trimmed : `https://${trimmed}`
    try {
        const url = new URL(candidate)
        // Userinfo smuggling ("trusted.com@evil.com") is never legitimate in
        // a SIWA domain or an observed origin; return the raw string so the
        // comparison fails safe (warns).
        if (url.username || url.password) {
            return trimmed
        }
        return url.host
    } catch {
        return trimmed
    }
}

/**
 * True when an ARC-60 request's self-asserted SIWA `domain` does not match the
 * platform-verified origin the request actually came from (the in-app
 * webview's loaded host). A mismatch is the signature of a relay/phishing
 * attempt: a page at origin A coaxing the user into signing an authentication
 * challenge bound to domain B, which the attacker then replays to log in as the
 * user on B.
 *
 * `verifiedOrigin` MUST be an origin the platform itself observed (never a
 * dApp-asserted value). Returns false when none is available — e.g.
 * WalletConnect, where the peer URL is self-asserted, so there is nothing
 * trustworthy to compare against and we must not raise a false positive.
 */
export const isArc60OriginMismatch = (
    domain: string,
    verifiedOrigin: string | undefined,
): boolean => {
    if (!verifiedOrigin) {
        return false
    }
    return hostFromMaybeUrl(domain) !== hostFromMaybeUrl(verifiedOrigin)
}
