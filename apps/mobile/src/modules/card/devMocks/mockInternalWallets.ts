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

// TODO(card): remove once Baanx enables the internal-wallet routes for Pera.
// The sandbox currently rejects them with "This route is only available for
// CUSTODIAL" — Pera's platform is non-custodial, and the manual-funding
// balance/withdraw backing is an open question with Baanx.

import { Decimal } from 'decimal.js'

/** Matches the Figma manual-funding overview (240.00 USDC). */
const INITIAL_BALANCE = new Decimal(240)

let balance = INITIAL_BALANCE

type MockInternalWallet = {
    id: string
    balance: string
    currency: string
    address: string
    addressMemo: string | null
    addressId: string
    type: string
}

/** Baanx wire shape for `GET /v1/wallet/internal`. */
export const buildMockInternalWallets = (): MockInternalWallet[] => [
    {
        id: 'mock-wallet-usdc',
        balance: balance.toFixed(2),
        currency: 'usdc',
        address: 'MOCKBAANXCUSTODIALADDRESS',
        addressMemo: null,
        addressId: 'mock-address-usdc',
        type: 'INTERNAL',
    },
]

/**
 * Decrements the mock balance (clamped at zero) so a withdrawal is visible on
 * the overview after the query invalidation refetches.
 */
export const applyMockWithdrawal = (amount: string): void => {
    balance = Decimal.max(balance.minus(new Decimal(amount)), 0)
}

export const resetMockInternalWallets = (): void => {
    balance = INITIAL_BALANCE
}
