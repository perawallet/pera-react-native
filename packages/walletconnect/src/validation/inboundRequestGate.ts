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
import {
    isV1ChainIdAcceptable,
    walletConnectSupportFor,
} from '../shared/chainSupport'

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

const NO_SIGNING_SUPPORT_REASON =
    'no signing support registered for this network'

type WcEnvelope = { id: number; params: unknown[] }

// A payload without a numeric id cannot be responded to, so it is dropped.
const asEnvelope = (payload: unknown): WcEnvelope | null => {
    if (typeof payload !== 'object' || payload === null) return null
    const candidate = payload as { id?: unknown; params?: unknown }
    if (typeof candidate.id !== 'number') return null
    if (!Array.isArray(candidate.params)) return null
    return { id: candidate.id, params: candidate.params }
}

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
    if (!isV1ChainIdAcceptable(input.sessionChainId, input.network)) {
        return reject(
            'chain id not acceptable on the active network',
            'invalid-network',
        )
    }

    // `isV1ChainIdAcceptable` above already proved a chain adapter serving v1
    // is registered for this network; this repeats the lookup rather than
    // threading it through, since both are cheap map reads.
    const support = walletConnectSupportFor(input.network)
    if (!support?.v1) return reject(NO_SIGNING_SUPPORT_REASON)

    const verdict = support.v1.screenRequest(
        'sign-transactions',
        envelope.params[0],
        input.knownAddresses,
    )
    if (!verdict.ok) return reject(verdict.reason)

    return accept
}

type SignDataEnvelope = { id: number; params: unknown }

// `algo_signData`'s `params` is a single ARC-60 wire object, not `algo_signTxn`'s
// array; only the id is checked here and the chain adapter validates `params`.
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
    if (!isV1ChainIdAcceptable(input.sessionChainId, input.network)) {
        return reject(
            'chain id not acceptable on the active network',
            'invalid-network',
        )
    }

    const support = walletConnectSupportFor(input.network)
    if (!support?.v1) return reject(NO_SIGNING_SUPPORT_REASON)

    const verdict = support.v1.screenRequest('sign-data', envelope.params, [])
    if (!verdict.ok) return reject(verdict.reason)

    return accept
}
