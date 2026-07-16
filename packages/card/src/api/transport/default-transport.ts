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
import { getValidIntegrityToken } from '@perawallet/wallet-core-app-integrity'
import { config } from '@perawallet/wallet-core-config'
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

/**
 * The Pera-backend `/api/v3/baanx/*` routes sit behind the app-integrity
 * guard, so every proxy call carries the device attestation token when a
 * non-expired one is available. On non-production builds (simulators can't
 * attest) the backend's env-gated staging/dev bypass header is sent as a
 * fallback — production backends ignore it, and production builds never send
 * it.
 */
const integrityHeaders = (): Record<string, string> => {
    const integrityToken = getValidIntegrityToken()
    if (integrityToken) {
        return { 'x-app-integrity-token': integrityToken }
    }
    if (config.appEnvironment !== 'production') {
        return { 'x-bypass-integrity': 'DEVELOPMENT_AND_STAGING_ONLY' }
    }
    return {}
}

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
        headers: { ...integrityHeaders(), ...req.headers },
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
            // Only `authenticated` calls carry the keystore Bearer, so only
            // they can benefit from a refresh: on a 401, refresh once and
            // retry; if refresh can't produce a token, surface the error.
            // Pre-auth calls (login, OTP) and the refresh exchange itself run
            // without the Bearer — intercepting those would be useless at
            // best and, for the refresh call, infinitely recursive. The proxy
            // (secret-key) and escrow (static-token) routes never carry a
            // refreshable Bearer either, so they never set the flag.
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
