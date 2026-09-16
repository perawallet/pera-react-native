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

import type { Decimal } from 'decimal.js'

/**
 * The two Baanx-held balances a user claims to their own wallet: rewards
 * earned on purchases, and credit from merchant refunds. Values are Baanx's
 * path segments (`/v1/wallet/{kind}`); both wallets share one contract. The
 * card's own internal wallet is a different contract (see `api/wallet`).
 */
export const CardWalletKind = {
    Reward: 'reward',
    Credit: 'credit',
} as const
export type CardWalletKind =
    (typeof CardWalletKind)[keyof typeof CardWalletKind]

/** GET /v1/wallet/{kind}. */
export type CardWalletBalance = {
    id: string
    /** Balance in display units (e.g. whole USDC). */
    balance: Decimal
    /** Currency code as Baanx sends it, lowercase, e.g. "usdc". */
    currency: string
    /** False while Baanx has withdrawals disabled for this wallet. */
    isWithdrawable: boolean
}

/** Network fee quote for a withdrawal: GET /v1/wallet/{kind}/withdraw-estimation. */
export type WalletWithdrawEstimation = {
    /** Fee in the payout network's NATIVE currency, display units. */
    fee: Decimal
    /** Fee in the network's smallest unit, as sent (opaque precision). */
    gas: string
}

/** Receipt for a withdrawal: POST /v1/wallet/{kind}/withdraw. */
export type WalletWithdrawResult = {
    /** Opaque payout-chain transaction hash (payout rail TBC with Baanx). */
    txHash: string
    /** Payout network name as Baanx sends it (e.g. "linea"); opaque to us. */
    network: string
    isConfirmed: boolean
}
