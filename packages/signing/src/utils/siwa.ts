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

import { canonify } from 'canonify'
import { z } from 'zod'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ByteLength, encodeToBase64 } from '@perawallet/wallet-core-shared'
import { Arc60BadJsonError } from './arc60-errors'

const maxBytes = (max: number) => (value: string) =>
    utf8ByteLength(value) <= max

/** Per the security review: statement ≤ 1KB, resources ≤ 32 × 256B, other fields capped. */
export const SIWA_MAX_STATEMENT_BYTES = 1024
export const SIWA_MAX_RESOURCES = 32
export const SIWA_MAX_RESOURCE_BYTES = 256
export const SIWA_MAX_FIELD_BYTES = 512
/** Decoded SIWA JSON hard cap (defense-in-depth before JSON.parse/canonify). */
export const SIWA_MAX_PAYLOAD_BYTES = 16 * 1024

// Per-field byte cap for SIWA descriptor strings ("sensible per-field cap"
// from the ARC-60 hardening ticket). Two variants because `.refine()` returns
// a ZodEffects, which has no `.min()` — so required fields must apply `.min(1)`
// *before* the refine, while optional fields chain `.optional()` after it.
const cappedField = z.string().refine(maxBytes(SIWA_MAX_FIELD_BYTES), {
    message: `exceeds ${SIWA_MAX_FIELD_BYTES} bytes`,
})
const requiredField = z
    .string()
    .min(1)
    .refine(maxBytes(SIWA_MAX_FIELD_BYTES), {
        message: `exceeds ${SIWA_MAX_FIELD_BYTES} bytes`,
    })

/**
 * Zod schema for a Sign-In With Algorand (SIWA) AUTH-scope payload. Field
 * names match the Lute reference implementation so payloads interop across
 * wallets.
 */
export const siwaSchema = z.object({
    domain: requiredField,
    account_address: requiredField,
    uri: requiredField,
    version: requiredField,
    statement: z
        .string()
        .refine(maxBytes(SIWA_MAX_STATEMENT_BYTES), {
            message: `statement exceeds ${SIWA_MAX_STATEMENT_BYTES} bytes`,
        })
        .optional(),
    nonce: cappedField.optional(),
    'issued-at': cappedField.optional(),
    'expiration-time': cappedField.optional(),
    'not-before': cappedField.optional(),
    'request-id': cappedField.optional(),
    chain_id: requiredField,
    resources: z
        .array(
            z.string().refine(maxBytes(SIWA_MAX_RESOURCE_BYTES), {
                message: `resource exceeds ${SIWA_MAX_RESOURCE_BYTES} bytes`,
            }),
        )
        .max(SIWA_MAX_RESOURCES)
        .optional(),
    type: z.literal('ed25519'),
})

export type Siwa = z.infer<typeof siwaSchema>

/**
 * Parses and validates a SIWA AUTH-scope payload.
 *
 * Enforces both schema shape and canonical JSON form (RFC 8785). The raw
 * JSON string the dApp sent MUST equal `canonify(parsed)` — otherwise two
 * equivalent payloads could produce two different signatures, which would
 * break signature-replay protections downstream. Mirrors Lute's behaviour.
 */
export const parseSiwa = (jsonString: string): Siwa => {
    if (utf8ByteLength(jsonString) > SIWA_MAX_PAYLOAD_BYTES) {
        throw new Arc60BadJsonError('payload exceeds the maximum allowed size')
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(jsonString)
    } catch (error) {
        throw new Arc60BadJsonError(
            'payload is not valid JSON',
            error instanceof Error ? error : undefined,
        )
    }

    const result = siwaSchema.safeParse(parsed)
    if (!result.success) {
        const summary = result.error.issues
            .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; ')
        throw new Arc60BadJsonError(summary)
    }

    const canonical = canonify(result.data)
    if (!canonical || canonical !== jsonString) {
        throw new Arc60BadJsonError('payload is not in canonical JSON form')
    }

    return result.data
}

export type BuildSiwaAuthRequestArgs = {
    domain: string
    /** The account proving ownership; becomes the SIWA `account_address`. */
    accountAddress: string
    uri: string
    /** Single-use anti-replay nonce. */
    nonce: string
    statement?: string
    /** TTL in ms for `expiration-time`. Defaults to 30 minutes. */
    ttlMs?: number
    /** Injected for deterministic tests; defaults to `new Date()`. */
    now?: Date
}

export type SiwaAuthRequest = {
    /** The canonical SIWA payload, exposed for callers that need to log it. */
    payload: Siwa
    /** base64(canonical JSON) — ready for `Arc60StdSigData.data`. */
    data: string
    /** sha256(domain) — ready for `Arc60StdSigData.authenticatorData`. */
    authenticatorData: Uint8Array
}

const SIWA_AUTH_DEFAULT_TTL_MS = 30 * 60 * 1000

/**
 * Builds a canonical ARC-60 AUTH-scope SIWA request the wallet signs itself
 * (as opposed to `parseSiwa`, which validates a request signed elsewhere).
 * The returned `data` is already canonicalized per RFC 8785 — the exact
 * bytes {@link parseSiwa} will re-derive and compare against.
 */
export const buildSiwaAuthRequest = ({
    domain,
    accountAddress,
    uri,
    nonce,
    statement,
    ttlMs = SIWA_AUTH_DEFAULT_TTL_MS,
    now = new Date(),
}: BuildSiwaAuthRequestArgs): SiwaAuthRequest => {
    const payload: Siwa = {
        domain,
        account_address: accountAddress,
        uri,
        version: '1',
        ...(statement !== undefined ? { statement } : {}),
        nonce,
        'issued-at': now.toISOString(),
        'expiration-time': new Date(now.getTime() + ttlMs).toISOString(),
        chain_id: 'algorand',
        type: 'ed25519',
    }

    const canonical = canonify(payload)
    if (canonical === undefined) {
        throw new Arc60BadJsonError('failed to canonicalize SIWA payload')
    }

    return {
        payload,
        data: encodeToBase64(new TextEncoder().encode(canonical)),
        authenticatorData: sha256(new TextEncoder().encode(domain)),
    }
}
