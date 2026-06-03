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

import ky, {
    type KyInstance,
    type BeforeRequestState,
    type SearchParamsOption,
} from 'ky'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import type { Network } from '@perawallet/wallet-core-shared'
import { getAccessToken } from '../../session/token-cache'
import type { CardTransportRequest, CardTransportResponse } from './types'

// One ky instance per Algorand network (mainnet → Baanx prod, testnet →
// Baanx sandbox). The base URL is fixed per instance; the Bearer is read
// fresh on every request so token refreshes apply without rebuilding clients.
const clients = new Map<Network, KyInstance>()

const attachHeaders =
    (clientKey: string) =>
    ({ request }: BeforeRequestState) => {
        request.headers.set('Content-Type', 'application/json')
        if (clientKey) {
            request.headers.set('x-client-key', clientKey)
        }
        const token = getAccessToken()
        if (token) {
            request.headers.set('Authorization', `Bearer ${token}`)
        }
    }

const getClient = (network: Network): KyInstance => {
    const existing = clients.get(network)
    if (existing) return existing

    const { baanxBaseUrl, baanxClientKey } = getNetworkConfig(network)
    const client = ky.create({
        prefix: baanxBaseUrl,
        hooks: { beforeRequest: [attachHeaders(baanxClientKey)] },
    })
    clients.set(network, client)
    return client
}

// ky's prefixUrl join rejects a leading slash on the path.
const toKyPath = (path: string): string =>
    path.startsWith('/') ? path.slice(1) : path

/**
 * Performs a direct call to Baanx. Non-2xx responses reject with ky's
 * `HTTPError` (the transport's 401-refresh wrapper relies on this). Reads the
 * body per `responseType`, tolerating empty bodies on JSON (204/empty 200).
 */
export const baanxDirectRequest = async <TData, TVars = unknown>(
    req: CardTransportRequest<TVars>,
): Promise<CardTransportResponse<TData>> => {
    const response = await getClient(req.network)(toKyPath(req.path), {
        method: req.method,
        searchParams: req.params as SearchParamsOption,
        ...(req.data !== undefined ? { json: req.data } : {}),
        signal: req.signal,
        headers: req.headers,
    })

    let data: TData
    switch (req.responseType ?? 'json') {
        case 'text':
            data = (await response.text()) as unknown as TData
            break
        case 'blob':
            data = (await response.blob()) as unknown as TData
            break
        case 'arraybuffer':
            data = (await response.arrayBuffer()) as unknown as TData
            break
        default: {
            const text = await response.text()
            data = (text.trim() ? JSON.parse(text) : undefined) as TData
        }
    }

    return { data, status: response.status, statusText: response.statusText }
}

/** Test-only: drops memoized clients so a new network config is picked up. */
export const resetBaanxClients = (): void => {
    clients.clear()
}
