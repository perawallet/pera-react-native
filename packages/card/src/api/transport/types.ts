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

import type { Network } from '@perawallet/wallet-core-shared'

/**
 * `direct` (default) → the package-local Baanx client (always x-client-key; the
 * per-user Bearer is added only when the request sets `authenticated: true`).
 * `proxy` → Pera's backend (`/api/v3/baanx/*`), which pins client_id /
 * redirect_uri server-side and injects the server-only x-secret-key where
 * Baanx requires it. Use `proxy` only for the OAuth initiate and
 * authorization-code token exchange; everything else (including the
 * refresh-token grant) goes direct.
 * `escrow` → the AppliedBlockchain (AB) card service (card creation + delegated
 * LSig `/lsig`), on its own base URL with a static raw `Authorization` token
 * from config. No per-user Bearer, no 401 refresh. SWAP POINT — AB-hosted on
 * testnet until Baanx wraps these endpoints.
 */
export type CardRoute = 'direct' | 'proxy' | 'escrow'

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
    /**
     * Attach the per-user Bearer (from the keystore) to this `direct` call. Set
     * ONLY on authenticated resources (card/user endpoints). Pre-auth calls —
     * registration, login, settings, onboarding consent — must leave it unset,
     * or a stale token from a prior session leaks in ("Missing User Data").
     */
    authenticated?: boolean
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
