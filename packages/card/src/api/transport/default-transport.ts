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

import { isHTTPError } from 'ky'
import { queryClient } from '@perawallet/wallet-core-shared'
import type {
    CardTransport,
    CardTransportRequest,
    CardTransportResponse,
} from './types'
import { baanxDirectRequest } from './baanx-client'
import { escrowRequest } from './escrow-client'

/**
 * Refreshes the session and returns whether a usable token is now available.
 * Injected by the session layer (via `setRefreshHandler`) to avoid a
 * transport → session import cycle.
 */
type RefreshHandler = () => Promise<boolean>

let refreshHandler: RefreshHandler | null = null

export const setRefreshHandler = (handler: RefreshHandler | null): void => {
    refreshHandler = handler
}

const isUnauthorized = (error: unknown): boolean =>
    isHTTPError(error) && error.response?.status === 401

const proxyRequest = <TData, TVars>(
    req: CardTransportRequest<TVars>,
): Promise<CardTransportResponse<TData>> =>
    queryClient<TData, TVars>({
        backend: 'pera',
        network: req.network,
        method: req.method,
        url: req.path,
        params: req.params,
        data: req.data,
        signal: req.signal,
        headers: req.headers,
        responseType: req.responseType,
    })

const dispatch = <TData, TVars>(
    req: CardTransportRequest<TVars>,
): Promise<CardTransportResponse<TData>> => {
    switch (req.route) {
        case 'proxy': {
            return proxyRequest<TData, TVars>(req)
        }
        case 'escrow': {
            return escrowRequest<TData, TVars>(req)
        }
        default: {
            return baanxDirectRequest<TData, TVars>(req)
        }
    }
}

export const defaultTransport: CardTransport = {
    request: async <TData, TVars = unknown>(
        req: CardTransportRequest<TVars>,
    ): Promise<CardTransportResponse<TData>> => {
        try {
            return await dispatch<TData, TVars>(req)
        } catch (error) {
            // Only direct calls carry the user Bearer. On a 401, refresh once
            // and retry; if refresh can't produce a token, surface the error.
            // Proxy (secret-key) and escrow (static-token) routes never carry a
            // refreshable Bearer, so they skip the retry.
            if (
                (req.route ?? 'direct') === 'direct' &&
                isUnauthorized(error) &&
                refreshHandler
            ) {
                const refreshed = await refreshHandler()
                if (refreshed) {
                    return await dispatch<TData, TVars>(req)
                }
            }
            throw error
        }
    },
}
