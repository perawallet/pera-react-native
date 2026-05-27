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

import { canonify } from 'canonify'
import { z } from 'zod'
import { Arc60BadJsonError } from './arc60-errors'

/**
 * SIWx chain id for Algorand. Equals the SLIP-0044 coin type (283) and is
 * constant across MainNet / TestNet (network is not part of the SIWA
 * identifier — the domain + authenticatorData binding is).
 */
export const SIWA_CHAIN_ID = '283'

/**
 * Zod schema for a Sign-In With Algorand (SIWA) AUTH-scope payload. Field
 * names match the Lute reference implementation so payloads interop across
 * wallets.
 */
export const siwaSchema = z.object({
    domain: z.string().min(1),
    account_address: z.string().min(1),
    uri: z.string().min(1),
    version: z.string().min(1),
    statement: z.string().optional(),
    // Required anti-replay token. ARC-60's AUTH scope is modeled on CAIP-122
    // (the chain-agnostic "Sign-In With X"), where `nonce` is mandatory: a
    // signed SIWA payload with no nonce is replayable, defeating the whole
    // point of the authentication challenge. Reject (rather than silently
    // sign) when it is absent or empty.
    nonce: z.string().min(1),
    'issued-at': z.string().optional(),
    'expiration-time': z.string().optional(),
    'not-before': z.string().optional(),
    'request-id': z.string().optional(),
    chain_id: z.literal(SIWA_CHAIN_ID),
    resources: z.array(z.string()).optional(),
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
