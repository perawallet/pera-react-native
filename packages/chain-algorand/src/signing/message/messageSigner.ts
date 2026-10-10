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

import { isQuantumAccount } from '@perawallet/wallet-core-accounts'
import type {
    MessageRequest,
    MessageSummary,
    Signature,
    SignedMessage,
    SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import {
    CannotSignError,
    type ArbitraryDataMessagePayload,
    type AuthDataPayload,
    type MessagePlanContext,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { decodeArbitraryDataForDisplay } from '../arbitraryDataDisplay'
import { arbitraryDataPayloadFor } from './arbitraryDataPayload'
import { arc60AuthPayloadFor } from './arc60AuthPayload'
import { Arc60InvalidSignerError } from './arc60-errors'
import { parseArc60ForDisplay } from './parseArc60ForDisplay'

const ARBITRARY_DATA_KEY = 'signing.arbitrary_data_view.body'
const AUTH_DATA_KEY = 'signing.arc60_view.title'
const AUTH_DATA_INVALID_KEY = 'signing.arc60_view.siwa_invalid'

/** Every i18n key a message summary can carry. */
export const ALGORAND_MESSAGE_TITLE_KEYS = [
    ARBITRARY_DATA_KEY,
    AUTH_DATA_KEY,
    AUTH_DATA_INVALID_KEY,
] as const

// Both kinds arrive over the one dApp method `algo_signData`, so the pipeline's
// kinds are the method names rather than the RPC name.
const ARBITRARY_DATA_METHOD = 'arbitrary-data'
const AUTH_DATA_METHOD = 'auth-data'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

// `payload` is `unknown` and may come from a dApp, so these readers are the
// trust boundary for `describe` and `plan`.
const readArbitraryData = (payload: unknown): ArbitraryDataMessagePayload => {
    if (!isRecord(payload) || typeof payload.data !== 'string') {
        throw new Error('The arbitrary-data message payload is malformed')
    }
    return { data: payload.data }
}

const readAuthData = (payload: unknown): AuthDataPayload => {
    if (
        !isRecord(payload) ||
        !isRecord(payload.authData) ||
        !isRecord(payload.metadata)
    ) {
        throw new Error('The auth-data message payload is malformed')
    }
    const { authData, metadata } = payload
    if (
        typeof authData.data !== 'string' ||
        typeof authData.signer !== 'string' ||
        typeof authData.domain !== 'string' ||
        !(authData.authenticatorData instanceof Uint8Array) ||
        (authData.requestId !== undefined &&
            typeof authData.requestId !== 'string') ||
        (authData.hdPath !== undefined &&
            typeof authData.hdPath !== 'string') ||
        typeof metadata.scope !== 'number' ||
        typeof metadata.encoding !== 'string'
    ) {
        throw new Error('The auth-data message payload is malformed')
    }
    return payload as AuthDataPayload
}

export const supportsAlgorandMessageMethod = (method: string): boolean =>
    method === ARBITRARY_DATA_METHOD || method === AUTH_DATA_METHOD

const describeArbitraryData = (payload: unknown): MessageSummary => {
    const title = { key: ARBITRARY_DATA_KEY }
    let data: ArbitraryDataMessagePayload
    try {
        data = readArbitraryData(payload)
    } catch {
        return { kind: 'raw', title }
    }
    const display = decodeArbitraryDataForDisplay(data.data)
    return display.kind === 'text'
        ? { kind: 'text', title, preview: display.text }
        : { kind: 'raw', title, preview: display.hex }
}

const describeAuthData = (payload: unknown): MessageSummary => {
    const invalid: MessageSummary = {
        kind: 'raw',
        title: { key: AUTH_DATA_INVALID_KEY },
    }
    let auth: AuthDataPayload
    try {
        auth = readAuthData(payload)
    } catch {
        return invalid
    }
    const parsed = parseArc60ForDisplay(
        auth.authData.data,
        auth.metadata.encoding,
    )
    if (parsed.type === 'error') {
        return invalid
    }
    const { statement } = parsed.siwx
    return {
        kind: 'text',
        title: { key: AUTH_DATA_KEY },
        ...(statement ? { preview: statement } : {}),
    }
}

export const describeAlgorandMessage = (
    request: MessageRequest,
): MessageSummary => {
    if (request.method === ARBITRARY_DATA_METHOD) {
        return describeArbitraryData(request.payload)
    }
    if (request.method === AUTH_DATA_METHOD) {
        return describeAuthData(request.payload)
    }
    throw new Error(`Unsupported message method ${request.method}`)
}

const planPayload = (
    request: MessageRequest,
    { account, accounts }: MessagePlanContext,
): Uint8Array => {
    if (request.method === ARBITRARY_DATA_METHOD) {
        return arbitraryDataPayloadFor(
            account,
            readArbitraryData(request.payload).data,
        )
    }
    const { authData, metadata } = readAuthData(request.payload)
    if (authData.signer !== request.signer) {
        throw new Arc60InvalidSignerError(
            authData.signer,
            `the request names ${request.signer} as its signer`,
        )
    }
    return arc60AuthPayloadFor(account, authData, metadata, accounts)
}

export const planAlgorandMessage = (
    request: MessageRequest,
    context: MessagePlanContext,
): SigningRequest[] => {
    const { account } = context
    if (request.scope.chainId !== ALGORAND_CHAIN_ID) {
        throw new Error(
            `Not an Algorand message request: ${request.scope.chainId}`,
        )
    }
    if (request.signer !== account.address) {
        throw new CannotSignError(
            account.address,
            `the request names ${request.signer} as its signer`,
        )
    }
    if (!supportsAlgorandMessageMethod(request.method)) {
        throw new CannotSignError(
            account.address,
            `unsupported message method ${request.method}`,
        )
    }
    return [
        {
            requestIndex: 0,
            signer: account.address,
            scheme: isQuantumAccount(account) ? 'falcon-1024' : 'ed25519',
            payload: planPayload(request, context),
        },
    ]
}

export const assembleAlgorandMessage = (
    request: MessageRequest,
    signatures: Signature[],
): SignedMessage => {
    const [signature] = signatures
    if (
        signatures.length !== 1 ||
        signature.requestIndex !== 0 ||
        signature.signer !== request.signer ||
        signature.bytes.length === 0
    ) {
        throw new Error(
            'An Algorand message takes exactly one signature, from its signer',
        )
    }
    return { scope: request.scope, signature }
}
