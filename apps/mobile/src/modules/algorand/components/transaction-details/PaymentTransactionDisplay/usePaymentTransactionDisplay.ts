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

import { useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export const usePaymentTransactionDisplay = (
    transaction: AlgorandTransactionView,
) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const payment = transaction.paymentTransaction
    const { decimals: nativeDecimals } = useNativeAsset(scope)

    const closeToAddress = payment?.closeRemainderTo
    // The hero shows the paid leg only, so a close-out's swept remainder
    // renders in its own row and the two never double-count.
    const closeAmountValue = useMemo(
        (): Nullable<Decimal> =>
            payment?.closeAmount === undefined
                ? null
                : baseUnitsToDisplayUnits(payment.closeAmount, nativeDecimals),
        [payment?.closeAmount, nativeDecimals],
    )

    return { payment, closeToAddress, closeAmountValue }
}
