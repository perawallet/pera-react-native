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
import type { Network } from '@perawallet/wallet-core-shared'
import type { WalletOperationType } from './models'

export type DappSigningParamsResult =
    | { ok: true; payload: unknown }
    | { ok: false; reason: 'missing' | 'out-of-bounds'; message: string }

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
     * The network name to report to a page, or undefined when this wallet
     * network must not be disclosed.
     */
    resolveReportedNetwork(
        network: Network,
        customGenesisHash: string | undefined,
    ): Network | undefined
}

export const dappRequestChainAdapters =
    createChainAdapterRegistry<DappRequestChainAdapter>('dapp-request')
