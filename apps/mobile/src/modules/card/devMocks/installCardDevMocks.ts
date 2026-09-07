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

// TODO(card): remove once AB provides the escrow base URL and Baanx ships the
// Algorand delegation post-approval. Dev-only: installed behind `__DEV__` from
// App.tsx, so it never ships.

import {
    getCardTransport,
    resetCardTransport,
    setCardTransport,
    type CardTransport,
    type CardTransportRequest,
    type CardTransportResponse,
} from '@perawallet/wallet-core-card'
import { applyMockDelegation } from './mockDelegation'
import {
    applyMockDelegatorLsig,
    buildMockEscrowCardCreation,
} from './mockEscrow'

const DELEGATION_POST_APPROVAL_PATH = '/v1/delegation/algorand/post-approval'
const ESCROW_APPROVALS_PATH = '/api/approvals'
const ESCROW_DELEGATOR_LSIG_PATH = '/api/internal/delegator-lsig'

// Every intercepted call is announced so a mocked step can never pass for a
// real one during QA.
const announce = (path: string): void => {
    console.warn(
        `[card dev mock] served ${path} from the dev mock, not Baanx/AB`,
    )
}

/**
 * Swaps in a transport that mocks ONLY the routes with no real counterpart
 * yet: Baanx's Algorand delegation post-approval (unshipped) and the AB
 * escrow card routes (creation approval + delegator LSig; AB has not provided
 * a base URL). Every other request, including all Baanx wallet, delegation
 * and transaction routes, goes to the real transport. Returns a disposer that
 * restores the default transport.
 */
export const installCardDevMocks = (): (() => void) => {
    const baseTransport = getCardTransport()

    const mockTransport: CardTransport = {
        request: <TData, TVars = unknown>(
            req: CardTransportRequest<TVars>,
        ): Promise<CardTransportResponse<TData>> => {
            if (
                req.method === 'POST' &&
                req.path === DELEGATION_POST_APPROVAL_PATH
            ) {
                announce(req.path)
                const data = applyMockDelegation(
                    req.data as {
                        address: string
                        amount: string
                        token: string
                    },
                ) as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (req.method === 'POST' && req.path === ESCROW_APPROVALS_PATH) {
                announce(req.path)
                const data = buildMockEscrowCardCreation(
                    req.data as { address: string },
                ) as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (
                req.method === 'POST' &&
                req.path === ESCROW_DELEGATOR_LSIG_PATH
            ) {
                announce(req.path)
                const data = applyMockDelegatorLsig(
                    req.data as { delegatorAddress: string },
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
