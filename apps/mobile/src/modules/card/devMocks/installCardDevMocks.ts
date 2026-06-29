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

// TODO(card): remove once the Baanx transactions sandbox returns data. This is
// dev-only — installed behind `__DEV__` from App.tsx, so it never ships.

import {
    getCardTransport,
    resetCardTransport,
    setCardTransport,
    type CardTransport,
    type CardTransportRequest,
    type CardTransportResponse,
} from '@perawallet/wallet-core-card'
import { buildMockCardTransactions } from './mockCardTransactions'

const TRANSACTIONS_PATH = '/v1/card/transactions'

/**
 * Swaps in a transport that serves mock transactions for
 * `GET /v1/card/transactions` (page 0; later pages are empty so the infinite
 * query terminates) and delegates every other request to the real transport.
 * Returns a disposer that restores the default transport.
 */
export const installCardDevMocks = (): (() => void) => {
    const baseTransport = getCardTransport()

    const mockTransport: CardTransport = {
        request: <TData, TVars = unknown>(
            req: CardTransportRequest<TVars>,
        ): Promise<CardTransportResponse<TData>> => {
            if (req.method === 'GET' && req.path === TRANSACTIONS_PATH) {
                const page = Number(req.params?.page ?? 0)
                const data = (
                    page === 0 ? buildMockCardTransactions() : []
                ) as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            return baseTransport.request<TData, TVars>(req)
        },
    }

    setCardTransport(mockTransport)
    return () => {
        resetCardTransport()
    }
}
