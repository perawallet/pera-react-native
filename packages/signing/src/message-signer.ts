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

/** What a message signer may use to sign: never a key or the KMS. */
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

/** What a message signer is asked to sign. */
export type MessageSignKind = 'arbitraryData' | 'authData'

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
    /** One signature per base64 item, with the account's own key; never follows rekey. */
    signArbitraryData(
        deps: MessageSigningDeps,
        account: WalletAccount,
        data: string[],
    ): Promise<Uint8Array[]>
    /** Validates, then signs with the account's own key. */
    signAuthData(
        deps: MessageSigningDeps,
        account: WalletAccount,
        authData: AuthData,
        metadata: AuthDataMetadata,
        accounts: WalletAccount[],
    ): Promise<Uint8Array>
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
