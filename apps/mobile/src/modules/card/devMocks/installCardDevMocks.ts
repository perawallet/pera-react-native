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

// TODO(card): remove once the Baanx transactions sandbox returns data and the
// internal-wallet routes are enabled for Pera (sandbox rejects them with "This
// route is only available for CUSTODIAL" — platform is non-custodial). This is
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
import {
    applyMockWithdrawal,
    buildMockInternalWallets,
} from './mockInternalWallets'
import {
    applyMockDelegation,
    buildMockDelegationProgram,
    buildMockDelegationToken,
    buildMockExternalWallets,
} from './mockDelegation'
import {
    applyMockDelegatorLsig,
    buildMockEscrowCardCreation,
} from './mockEscrow'

const TRANSACTIONS_PATH = '/v1/card/transactions'
const INTERNAL_WALLETS_PATH = '/v1/wallet/internal'
const WITHDRAW_PATH = '/v1/wallet/internal/withdraw'
const DELEGATION_TOKEN_PATH = '/v1/delegation/token'
const DELEGATION_CONFIG_PATH = '/v1/delegation/chain/config'
const DELEGATION_POST_APPROVAL_PATH = '/v1/delegation/algorand/post-approval'
const EXTERNAL_WALLETS_PATH = '/v1/wallet/external'
const ESCROW_APPROVALS_PATH = '/api/approvals'
const ESCROW_DELEGATOR_LSIG_PATH = '/api/internal/delegator-lsig'

/**
 * Swaps in a transport that serves mock transactions for
 * `GET /v1/card/transactions` (page 0; later pages are empty so the infinite
 * query terminates), a mock USDC internal wallet for the custodial-only
 * wallet routes (list + withdraw, with a stateful balance), the assumed
 * Algorand delegation routes (stateful allowance per address, single-use
 * tokens), and the AB escrow card routes (card creation + delegator LSig),
 * delegating every other request to the real transport. Returns a disposer
 * that restores the default transport.
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
            if (req.method === 'GET' && req.path === INTERNAL_WALLETS_PATH) {
                const data = buildMockInternalWallets() as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (req.method === 'POST' && req.path === WITHDRAW_PATH) {
                const { amount } = req.data as { amount: string }
                applyMockWithdrawal(amount)
                const data = { success: true } as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (req.method === 'GET' && req.path === DELEGATION_TOKEN_PATH) {
                const data = buildMockDelegationToken() as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (req.method === 'GET' && req.path === DELEGATION_CONFIG_PATH) {
                const data = buildMockDelegationProgram() as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (
                req.method === 'POST' &&
                req.path === DELEGATION_POST_APPROVAL_PATH
            ) {
                const data = applyMockDelegation(
                    req.data as {
                        address: string
                        amount: string
                        token: string
                    },
                ) as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (req.method === 'GET' && req.path === EXTERNAL_WALLETS_PATH) {
                const data = buildMockExternalWallets() as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (req.method === 'POST' && req.path === ESCROW_APPROVALS_PATH) {
                const data = buildMockEscrowCardCreation(
                    req.data as { address: string },
                ) as TData
                return Promise.resolve({ data, status: 200, statusText: 'OK' })
            }
            if (
                req.method === 'POST' &&
                req.path === ESCROW_DELEGATOR_LSIG_PATH
            ) {
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
