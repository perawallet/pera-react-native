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

import {
    createChainAdapterRegistry,
    type ChainId,
    type ChainScope,
    type MessageRequest,
    type MessageSummary,
    type Signature,
    type SignedMessage,
    type SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { LocalKeySigningDeps, WithChain } from './chain-adapter'
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

/** The chain-specific legs of signing a message; registered by the chain package. */
export interface MessageSignerChainAdapter {
    chainId: ChainId
    /** A method the chain doesn't list is refused by omission. */
    supports(method: string): boolean
    /** What the review shows. Never throws for a supported method, even on a payload `plan` refuses. */
    describe(request: MessageRequest): MessageSummary
    /**
     * The bytes to sign, `requestIndex` 0..n-1 in order, each `signer ===
     * context.account.address`.
     * @throws for an unsupported method, a malformed payload, a signer other
     * than `context.account`, or the chain's own refusals.
     */
    plan(request: MessageRequest, context: MessagePlanContext): SigningRequest[]
    /** @throws unless `signatures` answer `plan(request)` one for one. */
    assemble(request: MessageRequest, signatures: Signature[]): SignedMessage
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
    /**
     * The public key a hardware device signs auth data against.
     * @throws when `address` is invalid on the chain.
     */
    signerPublicKey(address: string): Uint8Array
    /** Ready to sign: `signer` is the address, with domain, scope and encoding filled in. */
    buildSiwxAuthData(args: BuildSiwxAuthDataArgs): AuthDataPayload
}

export const messageSignerChainAdapters =
    createChainAdapterRegistry<MessageSignerChainAdapter>('message signer')

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

export const isAuthDataWirePayload: WithChain<
    MessageSignerChainAdapter['isAuthDataWirePayload']
> = (chainId, ...args) =>
    messageSignerChainAdapters.get(chainId).isAuthDataWirePayload(...args)

export const parseAuthDataWireRequest: WithChain<
    MessageSignerChainAdapter['parseAuthDataWireRequest']
> = (chainId, ...args) =>
    messageSignerChainAdapters.get(chainId).parseAuthDataWireRequest(...args)

export const buildSiwxAuthData: WithChain<
    MessageSignerChainAdapter['buildSiwxAuthData']
> = (chainId, ...args) =>
    messageSignerChainAdapters.get(chainId).buildSiwxAuthData(...args)

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
        const adapter = messageSignerFor(request.scope.chainId, request.signer)
        if (!adapter.supports(request.method)) {
            throw new CannotSignError(
                request.signer,
                `unsupported message method ${request.method}`,
            )
        }
        const plan = adapter.plan(request, context)
        // Message signing never follows rekey: only the account's own key signs.
        if (plan.some(item => item.signer !== account.address)) {
            throw new CannotSignError(
                account.address,
                'a message must be signed by the account it names',
            )
        }
        return { adapter, request, plan }
    })
    if (!account.keyPairId) {
        throw new CannotSignError(
            account.address,
            'the account has no signing key',
        )
    }

    const payloads = planned.flatMap(({ plan }) =>
        plan.map(item => item.payload),
    )
    const results = await deps.signPayloads(account.keyPairId, payloads)
    if (results.length !== payloads.length) {
        throw new Error('The key store returned the wrong number of signatures')
    }

    let offset = 0
    return planned.map(({ adapter, request, plan }) => {
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
}
