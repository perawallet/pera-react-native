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
import { BASE64_PATTERN } from '@perawallet/wallet-core-signing/constants'
// Statement-level `import type`: a specifier-level `type` modifier compiles to a
// side-effect import of the package under `verbatimModuleSyntax`, which the
// specs that mock the signing barrel while loading this file by source path
// would then trip over.
import type { AuthDataPayload } from '@perawallet/wallet-core-signing'
import { Arc60BadRequestError } from './arc60-errors'

// Shared by every transport that accepts an ARC-60 request; re-declaring the
// schema or limits per transport lets the paths drift.

/** Serialized-size cap, enforced before parse/canonify to keep the UI thread responsive on hostile input. */
export const ARC60_MAX_REQUEST_BYTES = 64 * 1024

export const assertArc60RequestWithinLimits = (rawParams: unknown): void => {
    const serialized = JSON.stringify(rawParams) ?? ''
    if (utf8ByteLength(serialized) > ARC60_MAX_REQUEST_BYTES) {
        throw new Arc60BadRequestError(
            'request exceeds the maximum allowed size',
        )
    }
}

/** ARC-60's `StdSigData` + `Metadata` as sent on the wire; `authenticatorData` is base64 and decoded after parsing. */
export const arc60WireSchema = z.object({
    data: z.string().max(16 * 1024), // base64-encoded SIWA blob
    signer: z.string().min(1).max(128),
    domain: z.string().min(1).max(256),
    /**
     * ARC-60 requires the first 32 decoded bytes to be `sha256(domain)`, and 44
     * is the shortest base64 encoding of 32 bytes (`ceil(32/3)*4`).
     */
    authenticatorData: z.string().min(44).max(512).regex(BASE64_PATTERN),
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
 * Throws {@link Arc60BadRequestError} on any wire-level problem. Signer and
 * session checks are transport-specific and not done here.
 */
export const parseArc60WireRequest = (rawParams: unknown): AuthDataPayload => {
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
        authData: {
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
