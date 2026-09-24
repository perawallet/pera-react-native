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
import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import { queryClient } from '@perawallet/wallet-core-shared'
import type {
    CardTransport,
    CardTransportRequest,
    CardTransportResponse,
} from './types'
import { baanxDirectRequest } from './baanx-client'

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
        // Every `/api/v3/baanx/*` route sits behind the app-integrity guard.
        headers: { ...buildIntegrityHeaders(), ...req.headers },
        responseType: req.responseType,
        ...(req.timeoutMs !== undefined ? { timeout: req.timeoutMs } : {}),
    })

const dispatch = <TData, TVars>(
    req: CardTransportRequest<TVars>,
): Promise<CardTransportResponse<TData>> => {
    switch (req.route) {
        case 'proxy': {
            return proxyRequest<TData, TVars>(req)
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
            // Only `authenticated` calls carry the keystore Bearer, so only
            // they can benefit from a refresh: on a 401, refresh once and
            // retry; if refresh can't produce a token, surface the error.
            // Pre-auth calls (login, OTP) and the refresh exchange itself run
            // without the Bearer — intercepting those would be useless at
            // best and, for the refresh call, infinitely recursive. The proxy
            // route carries a server-side secret key, not a refreshable
            // Bearer, so it never sets the flag either.
            if (
                req.authenticated === true &&
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
