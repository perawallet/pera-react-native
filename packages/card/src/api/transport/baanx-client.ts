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

import ky, {
    type KyInstance,
    type BeforeRequestState,
    type SearchParamsOption,
} from 'ky'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { hasSecret, withSecret } from '@perawallet/wallet-core-kms'
import type { Network } from '@perawallet/wallet-core-shared'
import { ACCESS_TOKEN_SECRET_ID } from '../../session/secret-ids'
import type { CardTransportRequest, CardTransportResponse } from './types'
import { parseResponse, toKyPath } from './http-helpers'

// One ky instance per Algorand network (mainnet → Baanx prod, testnet →
// Baanx sandbox). Only the static `x-client-key` is attached at the client
// level; the per-user Bearer is read from the keystore per request below.
const clients = new Map<Network, KyInstance>()

const textDecoder = new TextDecoder()

const attachClientHeaders =
    (clientKey: string) =>
    ({ request }: BeforeRequestState) => {
        request.headers.set('Content-Type', 'application/json')
        if (clientKey) {
            request.headers.set('x-client-key', clientKey)
        }
    }

const getClient = (network: Network): KyInstance => {
    const existing = clients.get(network)
    if (existing) return existing

    const { baanxBaseUrl, baanxClientKey } = getNetworkConfig(network)
    const client = ky.create({
        prefix: baanxBaseUrl,
        hooks: { beforeRequest: [attachClientHeaders(baanxClientKey)] },
    })
    clients.set(network, client)
    return client
}

/**
 * Performs a direct call to Baanx. When the request is marked `authenticated`
 * the per-user access token is read from the encrypted keystore on demand via
 * `withSecret` — the decoded value lives only inside the handler (its bytes are
 * zeroed afterwards) and the request is made there, so the token is never
 * cached in app memory. Pre-auth calls (the default: registration, login,
 * settings, onboarding consent) run with `x-client-key` only, never a Bearer —
 * a stale token must not leak into them ("Missing User Data"). Non-2xx
 * responses reject with ky's `HTTPError`.
 */
export const baanxDirectRequest = async <TData, TVars = unknown>(
    req: CardTransportRequest<TVars>,
): Promise<CardTransportResponse<TData>> => {
    const client = getClient(req.network)

    const send = (authHeader?: string): Promise<Response> =>
        client(toKyPath(req.path), {
            method: req.method,
            searchParams: req.params as SearchParamsOption,
            ...(req.data !== undefined ? { json: req.data } : {}),
            signal: req.signal,
            headers: {
                ...req.headers,
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
        })

    if (req.authenticated && hasSecret(ACCESS_TOKEN_SECRET_ID)) {
        const result = await withSecret(ACCESS_TOKEN_SECRET_ID, bytes =>
            send(`Bearer ${textDecoder.decode(bytes)}`).then(response =>
                parseResponse<TData>(response, req.responseType),
            ),
        )
        if (result) return result
    }

    return parseResponse<TData>(await send(), req.responseType)
}

/** Test-only: drops memoized clients so a new network config is picked up. */
export const resetBaanxClients = (): void => {
    clients.clear()
}
