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
} from '@perawallet/wallet-core-chain-contract'
import type { RequestConfiguration } from '../models/queries'

/** The `queryClient` backends a chain's own nodes serve. */
export type NodeBackendName = Exclude<
    RequestConfiguration['backend'],
    'pera' | 'backup'
>

/** A node's base URL and the header its API token rides in; an empty token sends no header. */
export type NodeBackend = { url: string; tokenHeader: string; token: string }

/** Registered by a chain package so `queryClient` can reach that chain's nodes. */
export interface NodeBackendsAdapter {
    readonly chainId: ChainId
    /** Read on a scope's first node request, and again after `resetNodeClients`. */
    backendsFor(
        scope: ChainScope,
    ): Partial<Record<NodeBackendName, NodeBackend>>
}

export const nodeBackendAdapters =
    createChainAdapterRegistry<NodeBackendsAdapter>('nodeBackends')
