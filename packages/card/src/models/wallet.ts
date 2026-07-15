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
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * A Baanx-managed custodial wallet backing the card (GET /v1/wallet/internal).
 * The USDC wallet's balance is the spendable card balance; its address/memo
 * are the source fields for internal withdrawals.
 */
export type CardInternalWallet = {
    id: string
    /** Balance in display units (e.g. whole USDC). */
    balance: Decimal
    /** Currency code as Baanx sends it — lowercase, e.g. "usdc". */
    currency: string
    /** Deposit address; doubles as the withdraw sourceAddress. */
    address: string
    /** Memo/destination tag for memo-based networks; withdraw sourceMemo. */
    addressMemo: Nullable<string>
    addressId: string
    type: string
}
