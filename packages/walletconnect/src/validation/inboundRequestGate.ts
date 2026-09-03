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

import { type Network } from '@perawallet/wallet-core-shared'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing'
import { isChainIdAcceptable } from '../utils/chain'
import { arc60PayloadSchema, assertArc60RequestWithinLimits } from '../schema'

export type GateResult = { ok: true } | { ok: false; reason: string }

const reject = (reason: string): GateResult => ({ ok: false, reason })
const accept: GateResult = { ok: true }

// An undefined session chain id means the wallet has no record of the session
// the dapp is using (wiped storage, re-onboarded wallet) — a dapp-visible
// wrong-network message there sends users chasing the wrong problem.
// Keep it distinct from a genuine chain mismatch.
const SESSION_NOT_FOUND_REASON =
    'session not found — please disconnect and reconnect the dapp'

type WcEnvelope = { id: number; params: unknown[] }

/**
 * Every inbound `algo_signTxn` request is `{ id, params: [...] }` — an
 * array `params` (see {@link asSignDataEnvelope} below for why
 * `algo_signData`'s envelope shape differs). A payload failing this shape
 * cannot be responded to (no id to answer), so it is dropped.
 */
const asEnvelope = (payload: unknown): WcEnvelope | null => {
    if (typeof payload !== 'object' || payload === null) return null
    const candidate = payload as { id?: unknown; params?: unknown }
    if (typeof candidate.id !== 'number') return null
    if (!Array.isArray(candidate.params)) return null
    return { id: candidate.id, params: candidate.params }
}

type WalletTxnEntry = { txn?: unknown; signers?: unknown }

/**
 * Collects every address the request explicitly names in a `signers` array.
 * Deliberately does NOT decode the msgpack `txn` to recover its sender:
 * that is ARC-0001 resolution's job (multisig, authAddr and rekey make a
 * naive `snd` read wrong), and a wrong reject here would break a legitimate
 * request. An empty set therefore means "cannot tell", not "nobody".
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
        return reject(SESSION_NOT_FOUND_REASON)
    }
    if (!isChainIdAcceptable(input.sessionChainId, input.network)) {
        return reject('chain id not acceptable on the active network')
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

/**
 * `algo_signData`'s WC v1 envelope is `{ id, params: <ARC-60 wire object> }`
 * — `params` is a single object, unlike `algo_signTxn`'s array-of-arrays
 * shape (see {@link asEnvelope}). Only the `id` is required to have a fixed
 * shape here; `params` is validated by the caller against the ARC-60 schema.
 */
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

    // An array `params` is algo_signTxn's envelope shape arriving on
    // algo_signData — the two WC methods have genuinely different param
    // shapes (mirrors mobile's handleSignData, which routes to the ARC-60
    // path only when `!Array.isArray(params)`); reject rather than index
    // into it as if it were the other method's shape.
    if (Array.isArray(envelope.params)) {
        return reject('algo_signTxn shape received on algo_signData request')
    }

    if (input.sessionChainId === undefined) {
        return reject(SESSION_NOT_FOUND_REASON)
    }
    if (!isChainIdAcceptable(input.sessionChainId, input.network)) {
        return reject('chain id not acceptable on the active network')
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

    // Structural shape only — canonification and signer authorization stay
    // in the pipeline.
    const parsed = arc60PayloadSchema.safeParse(envelope.params)
    if (!parsed.success) return reject('ARC-60 payload failed schema')

    return accept
}
