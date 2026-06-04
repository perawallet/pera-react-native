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
import { hasSecret, withSecret } from '@perawallet/wallet-core-kms'
import type { Network } from '@perawallet/wallet-core-shared'
import { ACCESS_TOKEN_SECRET_ID } from '../../session/secret-ids'
import type {
    CardResponseType,
    CardTransportRequest,
    CardTransportResponse,
} from './types'

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

// ky's prefix join rejects a leading slash on the path.
const toKyPath = (path: string): string =>
    path.startsWith('/') ? path.slice(1) : path

const parseResponse = async <TData>(
    response: Response,
    responseType?: CardResponseType,
): Promise<CardTransportResponse<TData>> => {
    let data: TData
    switch (responseType ?? 'json') {
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

/**
 * Performs a direct call to Baanx. The access token is read from the encrypted
 * keystore on demand via `withSecret` — the decoded value lives only inside the
 * handler (its bytes are zeroed afterwards) and the request is made there, so
 * the token is never cached in app memory. Pre-auth calls (login, register/*)
 * run without a Bearer. Non-2xx responses reject with ky's `HTTPError`.
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

    if (hasSecret(ACCESS_TOKEN_SECRET_ID)) {
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
