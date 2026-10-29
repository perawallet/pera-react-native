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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    createChainAdapterRegistry,
    type ChainId,
    type ChainScope,
    type NetworkId,
    type SignedTransaction,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
// Type-only: keeps the `./dappRequest` subpath hook-free and light, since
// walletconnect resolves it from source without pulling in signing's runtime.
import type {
    ExternalSignTxnTransport,
    ReviewApproval,
    SignRequest,
} from '@perawallet/wallet-core-signing'
import type {
    DappMessageRequest,
    MessageOperationType,
    WalletOperationResult,
    WalletOperationType,
} from './models'

/**
 * Why a dApp request failed, in no chain's wire vocabulary. A namespace's
 * `toWireErrorCode` turns it into the numbers its dApps expect.
 */
export const DAPP_REQUEST_FAILURES = [
    'user-rejected',
    'unauthorized-account',
    'unsupported-method',
    'unselected-chain',
    'invalid-params',
    'limit-exceeded',
] as const

export type DappRequestFailure = (typeof DAPP_REQUEST_FAILURES)[number]

export class DappRequestRejectedError extends Error {
    readonly failure = 'user-rejected' as const

    constructor() {
        super('User rejected')
        this.name = 'DappRequestRejectedError'
    }
}

/**
 * The wallet refused the request without the user declining it. Absent a
 * `failure`, the dApp gets its namespace's generic internal error.
 */
export class DappRequestFailedError extends Error {
    readonly failure?: Exclude<DappRequestFailure, 'user-rejected'>

    constructor(
        message: string,
        failure?: Exclude<DappRequestFailure, 'user-rejected'>,
    ) {
        super(message)
        this.name = 'DappRequestFailedError'
        this.failure = failure
    }
}

export class PendingRequestCapacityError extends Error {
    readonly failure = 'limit-exceeded' as const

    constructor() {
        super('Too many requests are already open')
        this.name = 'PendingRequestCapacityError'
    }
}

/**
 * Read structurally rather than by `instanceof`: walletconnect resolves this
 * module as its own subpath copy, so a class check would miss an error built
 * in the main bundle.
 */
export const dappRequestFailureOf = (
    error: Error,
): Optional<DappRequestFailure> => {
    const { failure } = error as { failure?: unknown }
    return DAPP_REQUEST_FAILURES.find(known => known === failure)
}

/**
 * The wire code a chain picked for a refusal no {@link DappRequestFailure}
 * names. Structural for the same reason as {@link dappRequestFailureOf}.
 */
export const dappRequestWireCodeOf = (error: Error): Optional<number> => {
    const { wireCode } = error as { wireCode?: unknown }
    return typeof wireCode === 'number' ? wireCode : undefined
}

/**
 * Only this may answer a dApp with its user-rejected code: an EIP-1193 site
 * clears its whole approval queue on that answer. `UserCancelledError` is the
 * signing pipeline's, matched by name for the same reason as above.
 */
export const isDappUserRejection = (error: Error): boolean =>
    error.name === 'UserCancelledError' ||
    dappRequestFailureOf(error) === 'user-rejected'

export type DappSigningParamsResult =
    | { ok: true; payload: unknown }
    | { ok: false; reason: 'missing' | 'out-of-bounds'; message: string }

/**
 * A `sign-transactions` payload the registry's own validation has accepted,
 * plus the accounts it may sign for.
 */
export type TransactionSigningRequest = {
    group: readonly unknown[]
    authorizedAccounts: string[]
}

/**
 * Resolves with the enqueued request, or `null` when the group was answered
 * without one (nothing signable, or an invalid group refused up front).
 * Throws synchronously to refuse before anything is queued.
 */
export type EnqueueTransactionSigning = (
    request: TransactionSigningRequest,
    transport: ExternalSignTxnTransport,
) => Promise<Nullable<SignRequest>>

/** A chain's verdict on a dApp request object, the session-account check included. */
export type DappRequestValidation<Request = unknown> =
    | { ok: true; request: Request }
    | {
          ok: false
          failure: 'unauthorized-account' | 'invalid-params'
          /** Reaches the peer. */
          message: string
      }
    /** A refusal in the chain's own wire vocabulary: `code` reaches the peer verbatim. */
    | { ok: false; failure: 'coded'; code: number; message: string }

/**
 * A chain whose dApps ask the wallet to build and send a transaction from a
 * request object, rather than handing it a transaction to sign.
 */
export interface DappTransactionSending {
    /** Every refusal happens here, before anything is shown to the user. */
    validate(
        params: unknown,
        authorizedAccounts: readonly string[],
    ): DappRequestValidation
    /** Prices on the chain's selected network and rejects when the node can't. */
    build(request: unknown): Promise<UnsignedTransaction>
}

/** A batch the chain built ready for review, before the user approves it. */
export type PreparedDappBatch = {
    /** What the peer tracks the batch by. */
    batchId: string
    /** Signed on approval. */
    first: UnsignedTransaction
    /** Reviewed with `first`; the chain builds, signs and sends each once the one before it lands. */
    following: UnsignedTransaction[]
    /** The chain's own record of the request; only `start` reads it. */
    request: unknown
}

/**
 * A chain whose dApps send several transactions as one request, reviewed
 * once and run one after another.
 */
export interface DappBatchSending {
    /** Every refusal the params alone decide happens here, before anything is shown. */
    validate(
        params: unknown,
        authorizedAccounts: readonly string[],
    ): DappRequestValidation
    /** Builds what the review shows; rejects a batch the chain won't run. */
    prepare(request: unknown): Promise<PreparedDappBatch>
    /**
     * Resolves once the batch is recorded; the rest runs in the background,
     * each later transaction signed against `approval`, the review the user
     * approved.
     */
    start(
        prepared: PreparedDappBatch,
        first: SignedTransaction,
        approval: ReviewApproval,
    ): Promise<void>
    /** The batch's first transaction, when one of `authorizedAccounts` sent it. */
    locate(
        batchId: string,
        authorizedAccounts: readonly string[],
    ): Promise<Nullable<{ scope: ChainScope; txId: string }>>
}

/**
 * What a chain makes of one WalletConnect v2 request. `operation` params are
 * already off the JSON-RPC envelope. `public-data` is answered without asking
 * the user; a `null` answer refuses it as naming a chain this network isn't.
 */
export type WalletConnectRequestRoute =
    | { kind: 'operation'; type: WalletOperationType; params: unknown }
    | {
          kind: 'public-data'
          /** May settle later; a rejection carrying a wire code answers with it. */
          answer: (
              addresses: readonly string[],
              networkId: NetworkId,
          ) => Nullable<unknown> | Promise<Nullable<unknown>>
      }
    | { kind: 'unsupported' }
    /**
     * Any of the chain's networks; the handler refuses all but the selected
     * one, since no dApp moves the wallet's selection.
     */
    | { kind: 'switch-network'; networkId: NetworkId }
    /** Answered with `error` verbatim and never shown to the user. */
    | { kind: 'refused'; error: { code: number; message: string } }

export interface WalletConnectV2ChainSupport {
    /** Every method the chain answers, in the order an approved namespace declares them. */
    readonly methods: readonly string[]
    /** The subset of `methods` that asks the user, listed as a proposal's permissions. */
    readonly signingMethods: readonly string[]
    handleRequest(method: string, params: unknown): WalletConnectRequestRoute
    /**
     * Present means the chain's sessions get `chainChanged` and
     * `accountsChanged`. A `null` return skips the event.
     */
    readonly sessionEvents?: {
        chainChangedData(networkId: NetworkId): Nullable<unknown>
    }
}

/**
 * The per-chain half of answering a dApp's signing request. Shared by every
 * dApp transport, so a chain parses its payloads in one place.
 */
export interface DappRequestChainAdapter {
    readonly chainId: ChainId
    /** Error `name`s whose message may reach an untrusted page verbatim. */
    readonly relayableErrorNames: readonly string[]
    /**
     * Pulls the operation payload out of a signing request's params and
     * applies the chain's size caps. The registry's schema still does the full
     * validation.
     */
    parseSigningParams(
        type: WalletOperationType,
        params: Record<string, unknown>,
    ): DappSigningParamsResult
    /**
     * The network id to report to a page, or undefined when this wallet
     * network must not be disclosed.
     */
    resolveReportedNetwork(
        scope: ChainScope,
        customGenesisHash: Optional<string>,
    ): Optional<NetworkId>
    /**
     * Each address's empty signature on the active network: public data every
     * transport hands a dApp unprompted (WalletConnect's
     * `algo_getEmptySignatures`, the injected provider's connect result). An
     * address left out is unknown.
     */
    emptySignaturesFor(addresses: readonly string[]): Record<string, string>
    /** What WalletConnect (v1 and v2) needs to route and validate this chain's requests. */
    readonly walletConnect: {
        /** CAIP-2 namespace, v2 only. */
        readonly namespace: string
        /** `null`: this network has no CAIP-2 identity (e.g. a custom node). */
        caip2ChainIdFor(networkId: NetworkId): Nullable<string>
        /** The network a CAIP-2 chain id names, or `null` for none of ours. */
        networkForCaip2ChainId(caip2: string): Nullable<NetworkId>
        toWireResult(result: WalletOperationResult): unknown
        /**
         * Omitted by a namespace whose dApps expect the handler's defaults
         * (`-32000` for a failed request, WalletConnect SDK errors for a refusal).
         */
        toWireErrorCode?(failure: DappRequestFailure): number
        /** Omitted by a chain v1 never served. */
        readonly v1?: {
            isChainIdAcceptable(
                chainId: Optional<number>,
                networkId: NetworkId,
            ): boolean
            /** Wildcard already expanded to every network it covers. */
            networksFor(chainId: number): NetworkId[]
            screenRequest(
                type: WalletOperationType,
                params: unknown,
                knownAddresses: readonly string[],
            ): { ok: true } | { ok: false; reason: string }
        }
        /** Omitted by a chain v2 never serves; such a chain gets no v2 namespace. */
        readonly v2?: WalletConnectV2ChainSupport
    }
    /**
     * The registry's full validation for a `sign-transactions` payload, for
     * every transport; `message` reaches the peer.
     */
    validateTransactionPayload(
        payload: unknown,
    ): { ok: true; group: readonly unknown[] } | { ok: false; message: string }
    /** Omitted by a chain whose dApps send no transaction for the wallet to build. */
    readonly sendTransaction?: DappTransactionSending
    /** Omitted by a chain whose dApps send no batch of transactions. */
    readonly sendBatch?: DappBatchSending
    /**
     * Parses a `sign-message` or `sign-typed-data` request's params. The
     * signer comes back in the chain's canonical spelling. Omitted by a chain
     * that serves no dApp message.
     */
    validateMessagePayload?(
        type: MessageOperationType,
        params: unknown,
        authorizedAccounts: readonly string[],
    ): DappRequestValidation<DappMessageRequest>
    useEnqueueTransactionSigning: () => EnqueueTransactionSigning
    /**
     * The account kind the dApp bridge reports for `account` on `scope`, rekey
     * included; `accounts` is the wallet a delegated account's signer is
     * resolved against.
     */
    accountTypeOf(
        account: WalletAccount,
        accounts: WalletAccount[],
        scope: ChainScope,
    ): string
}

export const dappRequestChainAdapters =
    createChainAdapterRegistry<DappRequestChainAdapter>('dapp-request')

// Empty for a chain with no registered adapter, so a surface that sanitizes
// before bootstrap relays only the codec's chain-neutral names: fails closed.
export const dappRelayableErrorNames = (chainId: ChainId): readonly string[] =>
    dappRequestChainAdapters.has(chainId)
        ? dappRequestChainAdapters.get(chainId).relayableErrorNames
        : []
