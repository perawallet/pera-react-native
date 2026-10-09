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

import type { ChainKeyStore } from '../contracts/key-derivation'
import type {
    ChainCapabilities,
    ChainCapabilityRestrictions,
} from './capabilities'
import type { ChainDescriptor } from './descriptor'
import type { ChainScope } from './identity'

/** Base URLs keyed by the chain's own endpoint names. */
export type ChainEndpoints = Readonly<Record<string, string>>

export interface ChainHttpRequest {
    url: string
    method?: 'GET' | 'POST'
    headers?: Readonly<Record<string, string>>
    body?: string
    signal?: AbortSignal
}

export interface ChainHttpResponse {
    status: number
    body: string
}

export interface ChainHttpClient {
    request(req: ChainHttpRequest): Promise<ChainHttpResponse>
}

/**
 * The wallet's ceilings for a node request, in milliseconds. A chain client
 * adds no retries on top: TanStack Query retries reads and the signing
 * pipeline retries submission.
 */
export interface ChainRequestTimeouts {
    readMs: number
    submitMs: number
}

/**
 * Everything a chain package may reach; it never reads config or a store
 * directly. Scope and endpoints are getters because `register` runs once,
 * before the selected network can change.
 */
/** The Pera backend serving a scope; `baseUrl` is empty where `services` is. */
export interface ChainPeraBackend {
    baseUrl: string
    /** Pera service names, such as `blockFollowing`, the scope's backend offers. */
    services: ReadonlySet<string>
}

export interface ChainContext<E extends ChainEndpoints = ChainEndpoints> {
    getScope(): ChainScope
    getEndpoints(): E
    getPeraBackend(scope: ChainScope): ChainPeraBackend
    timeouts: ChainRequestTimeouts
    http: ChainHttpClient
    kms: ChainKeyStore
}

export interface ChainModule<E extends ChainEndpoints = ChainEndpoints> {
    descriptor: ChainDescriptor
    capabilityDefaults: ChainCapabilities
    /** The developer modes each capability is off in, e.g. because the chain's backend only serves mainnet. */
    capabilityRestrictions?: ChainCapabilityRestrictions
    /** Adds every adapter the chain implements to its feature registry; `registerChainSetup` registers the descriptor. */
    register(ctx: ChainContext<E>): void
    /** Every i18n key the chain's adapters emit as data, which the literal-`t()` lint can't see. */
    i18nKeys(): readonly string[]
}
