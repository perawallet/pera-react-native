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

import type { Network } from '@perawallet/wallet-core-shared'

/**
 * `direct` (default) → the package-local Baanx client (x-client-key + Bearer).
 * `proxy` → Pera's backend, which attaches the server-only x-secret-key and
 * forwards to Baanx. Use `proxy` only for calls that require the secret key
 * (e.g. OAuth token exchange / refresh).
 */
export type CardRoute = 'direct' | 'proxy'

export type CardHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type CardResponseType = 'json' | 'text' | 'blob' | 'arraybuffer'

export type CardTransportRequest<TVars = unknown> = {
    /** Defaults to 'direct'. */
    route?: CardRoute
    network: Network
    method: CardHttpMethod
    /** Baanx-native path, e.g. '/v1/card/status'. */
    path: string
    params?: Record<string, unknown>
    data?: TVars
    signal?: AbortSignal
    headers?: Record<string, string>
    responseType?: CardResponseType
}

export type CardTransportResponse<TData> = {
    data: TData
    status: number
    statusText: string
}

/**
 * The single seam every endpoint depends on. Endpoints call
 * `getCardTransport().request(...)` and never import a concrete client, so the
 * transport (proxy vs direct, or a test double) is swappable in one place.
 */
export interface CardTransport {
    request<TData, TVars = unknown>(
        req: CardTransportRequest<TVars>,
    ): Promise<CardTransportResponse<TData>>
}
