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

import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    createChainAdapterRegistry,
    type ChainId,
    type ChainScope,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
// Type-only: keeps the `./dappRequest` subpath hook-free and light, since
// walletconnect resolves it from source without pulling in signing's runtime.
import type {
    ExternalSignTxnTransport,
    SignRequest,
} from '@perawallet/wallet-core-signing'
import type { WalletOperationResult, WalletOperationType } from './models'

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
        customGenesisHash: string | undefined,
    ): NetworkId | undefined
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
        caip2ChainIdFor(networkId: NetworkId): string | null
        /** The network a CAIP-2 chain id names, or `null` for none of ours. */
        networkForCaip2ChainId(caip2: string): NetworkId | null
        toWireResult(result: WalletOperationResult): unknown
        /** Omitted by a chain v1 never served. */
        readonly v1?: {
            isChainIdAcceptable(
                chainId: number | undefined,
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
    }
    /**
     * The registry's full validation for a `sign-transactions` payload, for
     * every transport; `message` reaches the peer.
     */
    validateTransactionPayload(
        payload: unknown,
    ): { ok: true; group: readonly unknown[] } | { ok: false; message: string }
    useEnqueueTransactionSigning: () => EnqueueTransactionSigning
}

export const dappRequestChainAdapters =
    createChainAdapterRegistry<DappRequestChainAdapter>('dapp-request')

// Empty for a chain with no registered adapter, so a surface that sanitizes
// before bootstrap relays only the codec's chain-neutral names: fails closed.
export const dappRelayableErrorNames = (chainId: ChainId): readonly string[] =>
    dappRequestChainAdapters.has(chainId)
        ? dappRequestChainAdapters.get(chainId).relayableErrorNames
        : []
