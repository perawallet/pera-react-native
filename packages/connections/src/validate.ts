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
import { isNetworkId } from '@perawallet/wallet-core-chain-contract'
import { logger, toError } from '@perawallet/wallet-core-shared'
import {
    legacyArbitraryDataWireSchema,
    parseAuthDataWireRequest,
    type AuthDataSignableData,
} from '@perawallet/wallet-core-signing'
import {
    dappRequestChainAdapters,
    type DappRequestValidation,
} from './dappRequest'
import { ConnectionsError, DappRequestCodedError } from './errors'
import type {
    InboundMessage,
    RawInboundMessage,
    WalletOperation,
} from './models'

export type ValidationOutcome =
    | { ok: true; message: InboundMessage }
    | { ok: false; error: Error }

type RawRequest = Extract<RawInboundMessage, { kind: 'request' }>
type Answering = Pick<RawRequest, 'respond' | 'reject'>

/**
 * The transport errors on a duplicate response id and the pipeline has several
 * exit paths that each believe they own the answer. A rejected delivery
 * releases the guard (nothing reached the peer); a second answer is a wallet
 * bug, thrown to the caller and never routed to the user-facing error channel.
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

/**
 * Join zod issues into a field-path breadcrumb the peer can act on. Exported
 * so a chain's own `validateTransactionPayload` can format its schema
 * failures with the same wording this boundary used to produce inline.
 */
export const describeZodIssues = (error: z.ZodError): string =>
    error.issues
        .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')

const unserved = (type: string): ValidationOutcome => ({
    ok: false,
    error: new ConnectionsError(
        'unsupported-operation',
        `${type} requests are not served`,
    ),
})

const refused = (
    refusal: Extract<DappRequestValidation, { ok: false }>,
): ValidationOutcome => {
    if (refusal.failure === 'coded') {
        return {
            ok: false,
            error: new DappRequestCodedError(refusal.code, refusal.message),
        }
    }
    return {
        ok: false,
        error: new ConnectionsError(
            refusal.failure === 'unauthorized-account'
                ? 'unauthorized-account'
                : 'invalid-payload',
            refusal.message,
        ),
    }
}

export const validateRawMessage = (
    raw: RawInboundMessage,
): ValidationOutcome => {
    if (raw.kind === 'notification') {
        return { ok: true, message: raw }
    }

    if (!dappRequestChainAdapters.has(raw.chainId)) {
        return {
            ok: false,
            error: new ConnectionsError(
                'unsupported-chain',
                `No handler registered for chain ${raw.chainId}`,
            ),
        }
    }

    const { rawOperation } = raw

    if (rawOperation.type === 'send-transaction') {
        const { sendTransaction } = dappRequestChainAdapters.get(raw.chainId)
        if (!sendTransaction) return unserved(rawOperation.type)
        const result = sendTransaction.validate(
            rawOperation.params,
            raw.authorizedAccounts,
        )
        if (!result.ok) return refused(result)
        return accepted(raw, {
            type: 'send-transaction',
            request: result.request,
        })
    }

    if (rawOperation.type === 'send-batch') {
        const { sendBatch } = dappRequestChainAdapters.get(raw.chainId)
        if (!sendBatch) return unserved(rawOperation.type)
        const result = sendBatch.validate(
            rawOperation.params,
            raw.authorizedAccounts,
        )
        if (!result.ok) return refused(result)
        return accepted(raw, { type: 'send-batch', request: result.request })
    }

    if (rawOperation.type === 'show-batch') {
        const { sendBatch } = dappRequestChainAdapters.get(raw.chainId)
        if (!sendBatch) return unserved(rawOperation.type)
        const { params } = rawOperation
        const batchId =
            typeof params === 'object' && params !== null
                ? (params as { batchId?: unknown }).batchId
                : undefined
        if (typeof batchId !== 'string' || batchId.length === 0) {
            return {
                ok: false,
                error: new ConnectionsError(
                    'invalid-payload',
                    'Expected a batch id',
                ),
            }
        }
        return accepted(raw, { type: 'show-batch', batchId })
    }

    if (rawOperation.type === 'switch-network') {
        const adapter = dappRequestChainAdapters.get(raw.chainId)
        const { params } = rawOperation
        const networkId =
            typeof params === 'object' && params !== null
                ? (params as { networkId?: unknown }).networkId
                : undefined
        if (
            !isNetworkId(networkId) ||
            adapter.walletConnect.caip2ChainIdFor(networkId) === null
        ) {
            return {
                ok: false,
                error: new ConnectionsError(
                    'invalid-payload',
                    'The network cannot be switched to',
                ),
            }
        }
        return accepted(raw, { type: 'switch-network', networkId })
    }

    if (
        rawOperation.type === 'sign-message' ||
        rawOperation.type === 'sign-typed-data'
    ) {
        const adapter = dappRequestChainAdapters.get(raw.chainId)
        if (!adapter.validateMessagePayload) {
            return unserved(rawOperation.type)
        }
        const result = adapter.validateMessagePayload(
            rawOperation.type,
            rawOperation.params,
            raw.authorizedAccounts,
        )
        if (!result.ok) return refused(result)
        return accepted(raw, {
            type: rawOperation.type,
            request: result.request,
        })
    }

    if (
        rawOperation.type !== 'sign-transactions' &&
        rawOperation.type !== 'sign-data'
    ) {
        return unserved(rawOperation.type)
    }

    if (rawOperation.type === 'sign-transactions') {
        const result = dappRequestChainAdapters
            .get(raw.chainId)
            .validateTransactionPayload(rawOperation.params)
        if (!result.ok) {
            return {
                ok: false,
                error: new ConnectionsError('invalid-payload', result.message),
            }
        }
        return accepted(raw, {
            type: 'sign-transactions',
            group: result.group,
        })
    }

    // Discriminate on the raw input rather than `z.union`, which collapses
    // every failure to one root-level `invalid_union` issue.
    if (Array.isArray(rawOperation.params)) {
        const parsed = legacyArbitraryDataWireSchema.safeParse(
            rawOperation.params,
        )
        if (!parsed.success) {
            return {
                ok: false,
                error: new ConnectionsError(
                    'invalid-payload',
                    `Invalid algo_signData payload — ${describeZodIssues(parsed.error)}`,
                ),
            }
        }
        return accepted(raw, { type: 'sign-data', payload: parsed.data })
    }

    // Shared with the in-app webview bridge so the two transports cannot drift.
    let payload: AuthDataSignableData
    try {
        const { authData, metadata } = parseAuthDataWireRequest(
            raw.chainId,
            rawOperation.params,
        )
        payload = { type: 'auth-data', authData, metadata }
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
