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

import type { z } from 'zod'
import { logger, toError } from '@perawallet/wallet-core-shared'
import {
    parseArc60WireRequest,
    type Arc60SignableData,
} from '@perawallet/wallet-core-signing'
import { ConnectionsError } from './errors'
import type {
    InboundMessage,
    RawInboundMessage,
    WalletOperation,
} from './models'
import { arc0001GroupSchema, legacyArbitraryDataSchema } from './schema'

export type ValidationOutcome =
    | { ok: true; message: InboundMessage }
    | { ok: false; error: Error }

type RawRequest = Extract<RawInboundMessage, { kind: 'request' }>
type Answering = Pick<RawRequest, 'respond' | 'reject'>

/**
 * A request is answerable exactly once. The transport errors on a duplicate
 * response id and the signing pipeline has several exit paths that each
 * believe they own the answer, so the guard lives here as an invariant
 * rather than as a courtesy every handler re-implements. A delivery that
 * REJECTS releases the guard: nothing reached the peer, and that rejection is
 * how the pipeline learns the failure is retryable. A refused second answer is
 * a wallet programming error, so it is logged and thrown to the caller but
 * never routed to the user-facing error channel.
 */
const answerOnce = (raw: RawRequest): Answering => {
    let answered = false
    const guard = async (deliver: () => Promise<void>): Promise<void> => {
        if (answered) {
            logger.error('[connections] second answer to one request', {
                connectionId: raw.connectionId,
                correlationId: raw.correlationId,
            })
            throw new ConnectionsError(
                'already-answered',
                `Request ${raw.correlationId} on ${raw.connectionId} was already answered`,
            )
        }
        answered = true
        try {
            await deliver()
        } catch (error) {
            answered = false
            throw error
        }
    }
    return {
        respond: result => guard(() => raw.respond(result)),
        reject: error => guard(() => raw.reject(error)),
    }
}

const accepted = (
    raw: RawRequest,
    operation: WalletOperation,
): ValidationOutcome => {
    const { rawOperation: _dropped, ...rest } = raw
    return {
        ok: true,
        message: {
            ...rest,
            ...answerOnce(raw),
            kind: 'request',
            operation,
        },
    }
}

/** Join zod issues into a field-path breadcrumb the peer can act on. */
const describe = (error: z.ZodError): string =>
    error.issues
        .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')

export const validateRawMessage = (
    raw: RawInboundMessage,
): ValidationOutcome => {
    if (raw.kind === 'notification') {
        return { ok: true, message: raw }
    }

    const { rawOperation } = raw

    if (rawOperation.type === 'sign-transactions') {
        const parsed = arc0001GroupSchema.safeParse(rawOperation.params)
        if (!parsed.success) {
            return {
                ok: false,
                error: new ConnectionsError(
                    'invalid-payload',
                    `Invalid algo_signTxn payload — ${describe(parsed.error)}`,
                ),
            }
        }
        return accepted(raw, {
            type: 'sign-transactions',
            group: parsed.data,
        })
    }

    // ARC-60 (object) and the legacy shape (array) are structurally
    // disjoint, so discriminating on the RAW input before parsing keeps each
    // schema's own field-path breadcrumb intact — a `z.union` of the two
    // collapses every failure to one root-level `invalid_union` issue.
    if (Array.isArray(rawOperation.params)) {
        const parsed = legacyArbitraryDataSchema.safeParse(rawOperation.params)
        if (!parsed.success) {
            return {
                ok: false,
                error: new ConnectionsError(
                    'invalid-payload',
                    `Invalid algo_signData payload — ${describe(parsed.error)}`,
                ),
            }
        }
        return accepted(raw, { type: 'sign-data', payload: parsed.data })
    }

    // The ARC-60 wire shape, its size cap and the `authenticatorData` decode
    // all live in `@perawallet/wallet-core-signing`, shared with the in-app
    // webview bridge so the two transports cannot drift.
    let payload: Arc60SignableData
    try {
        const { stdSigData, metadata } = parseArc60WireRequest(
            rawOperation.params,
        )
        payload = { type: 'arc60', stdSigData, metadata }
    } catch (error) {
        const original = toError(error)
        return {
            ok: false,
            error: new ConnectionsError(
                'invalid-payload',
                `Invalid algo_signData payload — ${original.message}`,
                original,
            ),
        }
    }

    return accepted(raw, { type: 'sign-data', payload })
}
