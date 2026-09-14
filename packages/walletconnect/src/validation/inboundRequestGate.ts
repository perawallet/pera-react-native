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

import type { Network } from '@perawallet/wallet-core-shared'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing'
import { isChainIdAcceptable } from '../shared/chain'
import {
    arc60PayloadSchema,
    assertArc60RequestWithinLimits,
} from '../shared/schema'

/**
 * Which error the caller answers the peer with. `reason` is developer English
 * for the peer and the logs; the code is what selects the user-facing copy.
 */
export type GateRejectionCode =
    | 'invalid-network'
    | 'session-not-found'
    | 'invalid-request'

export type GateResult =
    | { ok: true }
    | { ok: false; reason: string; code: GateRejectionCode }

const reject = (
    reason: string,
    code: GateRejectionCode = 'invalid-request',
): GateResult => ({ ok: false, reason, code })
const accept: GateResult = { ok: true }

// An undefined session chain id means the wallet has no record of the session
// (wiped storage, re-onboarded wallet); a wrong-network message there would
// send users chasing the wrong problem.
const SESSION_NOT_FOUND_REASON =
    'session not found — please disconnect and reconnect the dapp'

type WcEnvelope = { id: number; params: unknown[] }

// A payload without a numeric id cannot be responded to, so it is dropped.
const asEnvelope = (payload: unknown): WcEnvelope | null => {
    if (typeof payload !== 'object' || payload === null) return null
    const candidate = payload as { id?: unknown; params?: unknown }
    if (typeof candidate.id !== 'number') return null
    if (!Array.isArray(candidate.params)) return null
    return { id: candidate.id, params: candidate.params }
}

type WalletTxnEntry = { txn?: unknown; signers?: unknown }

/**
 * Deliberately does not decode the msgpack `txn` for its sender: multisig,
 * authAddr and rekey make a naive `snd` read wrong, and that is ARC-0001
 * resolution's job. An empty result means "cannot tell", not "nobody".
 */
const namedSigners = (entries: WalletTxnEntry[]): string[] =>
    entries.flatMap(entry =>
        Array.isArray(entry.signers)
            ? entry.signers.filter(
                  (value): value is string => typeof value === 'string',
              )
            : [],
    )

export const gateSignTxnRequest = (input: {
    payload: unknown
    network: Network
    sessionChainId: number | undefined
    knownAddresses: readonly string[]
}): GateResult => {
    const envelope = asEnvelope(input.payload)
    if (!envelope) return reject('malformed WC envelope')

    if (input.sessionChainId === undefined) {
        return reject(SESSION_NOT_FOUND_REASON, 'session-not-found')
    }
    if (!isChainIdAcceptable(input.sessionChainId, input.network)) {
        return reject(
            'chain id not acceptable on the active network',
            'invalid-network',
        )
    }

    const group = envelope.params[0]
    if (!Array.isArray(group) || group.length === 0) {
        return reject('empty or non-array transaction list')
    }
    if (group.length > MAX_TRANSACTION_SIGN_REQUESTS) {
        return reject('too many transactions in one request')
    }

    const entries = group as WalletTxnEntry[]
    if (entries.some(entry => typeof entry?.txn !== 'string')) {
        return reject('transaction entry without a txn string')
    }

    // Conservative: only reject when the request names signers and none of
    // them is ours. Naming nothing is deferred to the pipeline.
    const named = namedSigners(entries)
    if (named.length > 0) {
        const known = new Set(input.knownAddresses)
        if (!named.some(address => known.has(address))) {
            return reject('no named signer belongs to this wallet')
        }
    }

    return accept
}

type SignDataEnvelope = { id: number; params: unknown }

// `algo_signData`'s `params` is a single ARC-60 wire object, not `algo_signTxn`'s
// array; only the id is checked here and the caller validates `params`.
const asSignDataEnvelope = (payload: unknown): SignDataEnvelope | null => {
    if (typeof payload !== 'object' || payload === null) return null
    const candidate = payload as { id?: unknown; params?: unknown }
    if (typeof candidate.id !== 'number') return null
    return { id: candidate.id, params: candidate.params }
}

export const gateSignDataRequest = (input: {
    payload: unknown
    network: Network
    sessionChainId: number | undefined
}): GateResult => {
    const envelope = asSignDataEnvelope(input.payload)
    if (!envelope) return reject('malformed WC envelope')

    // An array `params` is algo_signTxn's shape arriving on algo_signData;
    // reject rather than index into it as if it were the other method's.
    if (Array.isArray(envelope.params)) {
        return reject('algo_signTxn shape received on algo_signData request')
    }

    if (input.sessionChainId === undefined) {
        return reject(SESSION_NOT_FOUND_REASON, 'session-not-found')
    }
    if (!isChainIdAcceptable(input.sessionChainId, input.network)) {
        return reject(
            'chain id not acceptable on the active network',
            'invalid-network',
        )
    }

    try {
        assertArc60RequestWithinLimits(envelope.params)
    } catch (error) {
        return reject(
            error instanceof Error
                ? error.message
                : 'ARC-60 payload rejected by size cap',
        )
    }

    // Structural shape only; canonification and signer authorization stay in the pipeline.
    const parsed = arc60PayloadSchema.safeParse(envelope.params)
    if (!parsed.success) return reject('ARC-60 payload failed schema')

    return accept
}
