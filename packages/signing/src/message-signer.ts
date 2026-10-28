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

import type {
    ChainId,
    ChainScope,
    MessageRequest,
    MessageSummary,
    Signature,
    SignedMessage,
    SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    messageSignerChainAdapters,
    type LocalKeySigningDeps,
    type ReviewedAddress,
    type WithChain,
} from './chain-adapter'
import { CannotSignError } from './pipeline/errors'
import type {
    AuthData,
    AuthDataMetadata,
    AuthDataPayload,
} from './pipeline/types'

/**
 * The CAIP-122 data model shared by SIWE, SIWS and Algorand's sign-in. Each
 * chain owns the serialisation and the signature `type`, so neither is here.
 */
export type SiwxMessage = {
    domain: string
    address: string
    uri: string
    version: string
    chainId: string
    statement?: string
    nonce?: string
    issuedAt?: string
    expirationTime?: string
    notBefore?: string
    requestId?: string
    resources?: string[]
}

export type ParsedAuthData =
    | { type: 'siwx'; siwx: SiwxMessage }
    | { type: 'error'; message: string }

/** How the host signs a planned payload with the account's own key; adapters never receive it. */
export type MessageSigningDeps = Pick<LocalKeySigningDeps, 'signPayloads'>

export type BuildSiwxAuthDataArgs = {
    domain: string
    /** The account proving ownership. */
    address: string
    uri: string
    /** Single-use anti-replay nonce. */
    nonce: string
    statement?: string
    /** TTL in ms for the expiration time. Defaults to 30 minutes. */
    ttlMs?: number
    /** Injected for deterministic tests; defaults to `new Date()`. */
    now?: Date
}

/**
 * What a message signer is asked to sign. `'message'` is free-form bytes the
 * chain signs under its own message prefix; `'typedData'` is a schema-typed
 * structured message.
 */
export type MessageSignKind =
    | 'arbitraryData'
    | 'authData'
    | 'message'
    | 'typedData'

export type MessagePlanContext = {
    /** The record `request.signer` names, signed with its own key and never followed through rekey. */
    account: WalletAccount
    /** Every wallet account, for checks that read another record. Read at call time. */
    accounts: WalletAccount[]
}

/** The `MessageRequest.payload` for method `'arbitrary-data'`: one base64 item. */
export type ArbitraryDataMessagePayload = { data: string }

const ARBITRARY_DATA_METHOD = 'arbitrary-data'
const AUTH_DATA_METHOD = 'auth-data'

export const arbitraryDataMessageRequest = (
    scope: ChainScope,
    signer: string,
    data: string,
): MessageRequest => ({
    scope,
    method: ARBITRARY_DATA_METHOD,
    signer,
    payload: { data } satisfies ArbitraryDataMessagePayload,
})

export const authDataMessageRequest = (
    scope: ChainScope,
    signer: string,
    payload: AuthDataPayload,
): MessageRequest => ({
    scope,
    method: AUTH_DATA_METHOD,
    signer,
    payload,
})

/** The sign-in (CAIP-122 auth-data) legs, which only a chain that signs `'authData'` provides. */
export interface AuthDataSigner {
    /**
     * The host-side checks every signer shares.
     * @throws when the request must be rejected.
     */
    validateAuthData(
        authData: AuthData,
        metadata: AuthDataMetadata,
        accounts: WalletAccount[],
    ): { decodedData: Uint8Array }
    /** Never throws. */
    parseAuthDataForDisplay(data: string, encoding: string): ParsedAuthData
    isAuthDataWirePayload(params: unknown): boolean
    parseAuthDataWireRequest(rawParams: unknown): AuthDataPayload
    /** Ready to sign: `signer` is the address, with domain, scope and encoding filled in. */
    buildSiwxAuthData(args: BuildSiwxAuthDataArgs): AuthDataPayload
}

/** The chain-specific legs of signing a message; registered by the chain package. */
export interface MessageSignerChainAdapter {
    chainId: ChainId
    /** Whether `account` can sign `kind` on this chain, judged from the account alone. */
    canSign(account: WalletAccount, kind: MessageSignKind): boolean
    /**
     * Whether a requester can verify the signature `account` makes for
     * `kind`. A key of a scheme the message format doesn't carry still passes
     * {@link canSign}, so the review blocks it instead of refusing the request.
     */
    signsVerifiably(account: WalletAccount, kind: MessageSignKind): boolean
    /** A method the chain doesn't list is refused by omission. */
    supports(method: string): boolean
    /** What the review shows. Never throws for a supported method, even on a payload `plan` refuses. */
    describe(request: MessageRequest): MessageSummary
    /**
     * The addresses the signed message names, read from its schema whether or
     * not `describe` recognises what it grants. Never throws; `[]` for a
     * payload it can't read.
     */
    reviewedAddresses(request: MessageRequest): ReviewedAddress[]
    /**
     * The bytes to sign, `requestIndex` 0..n-1 in order, each signer the
     * account's own address on the request's chain.
     * @throws for an unsupported method, a malformed payload, a signer other
     * than `context.account`, or the chain's own refusals.
     */
    plan(request: MessageRequest, context: MessagePlanContext): SigningRequest[]
    /**
     * Throws unless `signatures` answer `plan(request)` one for one. May
     * verify them first, so it can answer asynchronously.
     */
    assemble(
        request: MessageRequest,
        signatures: Signature[],
    ): SignedMessage | Promise<SignedMessage>
    authData?: AuthDataSigner
}

export { messageSignerChainAdapters }

/** False on a chain with no message signer: it signs nothing. */
export const canSignMessage = (
    chainId: ChainId,
    account: WalletAccount,
    kind: MessageSignKind,
): boolean =>
    messageSignerChainAdapters.has(chainId) &&
    messageSignerChainAdapters.get(chainId).canSign(account, kind)

/** False on a chain with no message signer, so a review blocks the request. */
export const signsMessageVerifiably = (
    chainId: ChainId,
    account: WalletAccount,
    kind: MessageSignKind,
): boolean =>
    messageSignerChainAdapters.has(chainId) &&
    messageSignerChainAdapters.get(chainId).signsVerifiably(account, kind)

/** `[]` on a chain with no message signer. */
export const reviewedMessageAddressesOf = (
    request: MessageRequest,
): ReviewedAddress[] =>
    messageSignerChainAdapters.has(request.scope.chainId)
        ? messageSignerChainAdapters
              .get(request.scope.chainId)
              .reviewedAddresses(request)
        : []

/** The refusal gate: with no signer registered, nothing is signed or passed through unsigned. */
export const messageSignerFor = (
    chainId: ChainId,
    signerAddress: string,
): MessageSignerChainAdapter => {
    if (!messageSignerChainAdapters.has(chainId)) {
        throw new CannotSignError(
            signerAddress,
            `no message signer is registered for chain ${chainId}`,
        )
    }
    return messageSignerChainAdapters.get(chainId)
}

const requireAuthData = (chainId: ChainId): AuthDataSigner => {
    const { authData } = messageSignerChainAdapters.get(chainId)
    if (!authData) {
        throw new Error(`chain ${chainId} has no auth-data signer`)
    }
    return authData
}

export const isAuthDataWirePayload: WithChain<
    AuthDataSigner['isAuthDataWirePayload']
> = (chainId, ...args) =>
    messageSignerChainAdapters
        .get(chainId)
        .authData?.isAuthDataWirePayload(...args) ?? false

export const parseAuthDataWireRequest: WithChain<
    AuthDataSigner['parseAuthDataWireRequest']
> = (chainId, ...args) =>
    requireAuthData(chainId).parseAuthDataWireRequest(...args)

export const buildSiwxAuthData: WithChain<
    AuthDataSigner['buildSiwxAuthData']
> = (chainId, ...args) => requireAuthData(chainId).buildSiwxAuthData(...args)

/**
 * Plans every request before the first key-store call, so a refused item never
 * leaves a sibling signed, then signs all payloads in one call.
 */
export const signMessages = async (
    requests: MessageRequest[],
    context: MessagePlanContext,
    deps: MessageSigningDeps,
): Promise<SignedMessage[]> => {
    if (requests.length === 0) {
        return []
    }
    const { account } = context
    const planned = requests.map(request => {
        const own = chainAccountOf(account, request.scope.chainId)
        const address = own?.address ?? ''
        const adapter = messageSignerFor(request.scope.chainId, request.signer)
        if (!adapter.supports(request.method)) {
            throw new CannotSignError(
                request.signer,
                `unsupported message method ${request.method}`,
            )
        }
        const plan = adapter.plan(request, context)
        // Message signing never follows rekey: only the account's own key signs.
        if (plan.some(item => item.signer !== address)) {
            throw new CannotSignError(
                address,
                'a message must be signed by the account it names',
            )
        }
        return { adapter, request, plan, address, keyPairId: own?.keyPairId }
    })
    const [{ address, keyPairId }] = planned
    if (!keyPairId) {
        throw new CannotSignError(address, 'the account has no signing key')
    }
    // The key store signs the batch in one call, under one key.
    if (planned.some(item => item.keyPairId !== keyPairId)) {
        throw new CannotSignError(
            address,
            'messages signed together must share a signing key',
        )
    }

    const payloads = planned.flatMap(({ plan }) =>
        plan.map(item => item.payload),
    )
    const results = await deps.signPayloads(keyPairId, payloads)
    if (results.length !== payloads.length) {
        throw new Error('The key store returned the wrong number of signatures')
    }

    let offset = 0
    const assembled = planned.map(({ adapter, request, plan }) => {
        const signatures = plan.map(
            ({ requestIndex, signer, scheme }, index): Signature => ({
                requestIndex,
                signer,
                scheme,
                bytes: results[offset + index],
            }),
        )
        offset += plan.length
        return adapter.assemble(request, signatures)
    })
    return Promise.all(assembled)
}
