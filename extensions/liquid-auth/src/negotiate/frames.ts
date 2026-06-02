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
    HANDSHAKE_VERSION,
    NEGOTIATE_NAMESPACE,
    NEGOTIATION_ERROR_CODES,
    type NegotiateOffer,
    type NegotiationErrorCode,
    type SelectedProtocol,
} from './types'
import { NegotiationError } from './errors'
import { uuidv4 } from '../utils/uuid'

const SELECT_REFERENCE = `${NEGOTIATE_NAMESPACE}:negotiate:select`

export const parseOffer = (raw: string): NegotiateOffer => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new NegotiationError(
            NEGOTIATION_ERROR_CODES.MalformedOfferError,
            'Malformed negotiation offer',
        )
    }
    const env = parsed as { id?: unknown; params?: Record<string, unknown> }
    const params = env.params ?? {}
    if (typeof env.id !== 'string') {
        // No usable requestId to correlate a 5002 reply — the negotiator closes
        // silently in this case (see MalformedOfferError with no id below).
        throw new NegotiationError(
            NEGOTIATION_ERROR_CODES.MalformedOfferError,
            'Offer missing id',
        )
    }
    // Validate each protocol entry so a malformed one (null, missing versions)
    // can't crash selectProtocol downstream. `id` known => the negotiator can
    // and must reply 5002 rather than wedging the channel.
    if (!Array.isArray(params.protocols) || params.protocols.length === 0) {
        throw new NegotiationError(
            NEGOTIATION_ERROR_CODES.MalformedOfferError,
            'Offer missing protocols',
            undefined,
            env.id,
        )
    }
    const protocols: NegotiateOffer['protocols'] = []
    for (const entry of params.protocols) {
        if (
            !entry ||
            typeof entry !== 'object' ||
            typeof (entry as { id?: unknown }).id !== 'string' ||
            !Array.isArray((entry as { versions?: unknown }).versions) ||
            !(entry as { versions: unknown[] }).versions.every(
                v => typeof v === 'string',
            )
        ) {
            throw new NegotiationError(
                NEGOTIATION_ERROR_CODES.MalformedOfferError,
                'Offer has a malformed protocol entry',
                undefined,
                env.id,
            )
        }
        protocols.push(entry as NegotiateOffer['protocols'][number])
    }
    return {
        id: env.id,
        handshakeVersion:
            typeof params.handshakeVersion === 'number'
                ? params.handshakeVersion
                : NaN,
        liquidAuthVersion:
            typeof params.liquidAuthVersion === 'string'
                ? params.liquidAuthVersion
                : undefined,
        protocols,
        peer:
            params.peer && typeof params.peer === 'object'
                ? (params.peer as NegotiateOffer['peer'])
                : undefined,
    }
}

export const buildSelect = (
    requestId: string,
    protocol: SelectedProtocol,
): string =>
    JSON.stringify({
        id: uuidv4(),
        reference: SELECT_REFERENCE,
        requestId,
        result: { handshakeVersion: HANDSHAKE_VERSION, protocol },
    })

export const buildSelectError = (
    requestId: string,
    code: NegotiationErrorCode,
    message: string,
    data?: unknown,
): string =>
    JSON.stringify({
        id: uuidv4(),
        reference: SELECT_REFERENCE,
        requestId,
        error: { code, message, ...(data === undefined ? {} : { data }) },
    })
