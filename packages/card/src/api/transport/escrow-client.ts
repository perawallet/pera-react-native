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
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    CardResponseType,
    CardTransportRequest,
    CardTransportResponse,
} from './types'

/**
 * Thrown when an `escrow`-route call is attempted but no AB base URL is
 * configured. In dev the transport is swapped for a mock before dispatch (see
 * `installCardDevMocks`), so this only surfaces on a real build whose escrow
 * env values were not injected — where it should fail loudly rather than hit
 * an empty origin.
 */
export class CardEscrowNotConfiguredError extends Error {
    constructor() {
        super(
            'AppliedBlockchain card escrow service is not configured (missing base URL)',
        )
        this.name = 'CardEscrowNotConfiguredError'
    }
}

// One ky instance per Algorand network, prefixed at the AB escrow base URL.
const clients = new Map<Network, KyInstance>()

// The AB service authenticates with a static token sent as a RAW Authorization
// header (no "Bearer" prefix) — matches AppliedBlockchain's demo verifier.
const attachEscrowHeaders =
    (authToken: string) =>
    ({ request }: BeforeRequestState) => {
        request.headers.set('Content-Type', 'application/json')
        if (authToken) {
            request.headers.set('Authorization', authToken)
        }
    }

const getClient = (network: Network): KyInstance => {
    const existing = clients.get(network)
    if (existing) return existing

    const { cardEscrowBaseUrl, cardEscrowAuthToken } = getNetworkConfig(network)
    if (!cardEscrowBaseUrl) {
        throw new CardEscrowNotConfiguredError()
    }
    const client = ky.create({
        prefix: cardEscrowBaseUrl,
        hooks: { beforeRequest: [attachEscrowHeaders(cardEscrowAuthToken)] },
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
        case 'text': {
            data = (await response.text()) as unknown as TData
            break
        }
        case 'blob': {
            data = (await response.blob()) as unknown as TData
            break
        }
        case 'arraybuffer': {
            data = (await response.arrayBuffer()) as unknown as TData
            break
        }
        default: {
            const text = await response.text()
            data = (text.trim() ? JSON.parse(text) : undefined) as TData
        }
    }
    return { data, status: response.status, statusText: response.statusText }
}

/**
 * Performs a call to the AB escrow card service. Non-2xx responses reject with
 * ky's `HTTPError`. Throws {@link CardEscrowNotConfiguredError} when the base
 * URL is unset.
 */
export const escrowRequest = async <TData, TVars = unknown>(
    req: CardTransportRequest<TVars>,
): Promise<CardTransportResponse<TData>> => {
    const client = getClient(req.network)

    const response = await client(toKyPath(req.path), {
        method: req.method,
        searchParams: req.params as SearchParamsOption,
        ...(req.data !== undefined ? { json: req.data } : {}),
        signal: req.signal,
        headers: req.headers,
    })

    return parseResponse<TData>(response, req.responseType)
}

/** Test-only: drops memoized clients so a new network config is picked up. */
export const resetEscrowClients = (): void => {
    clients.clear()
}
