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
import { useAccountInformationQuery } from '@perawallet/wallet-core-accounts'
import { algosToMicroAlgosBigInt } from '@perawallet/wallet-core-blockchain'

import type { Decimal } from 'decimal.js'

export type UseRekeyFeePreflightResult = {
    /**
     * True when the source's spendable balance (balance − min-balance
     * reserve, in microalgos) cannot cover the rekey fee. Stays false while
     * the fee or the balance row is still loading — missing data never
     * blocks the flow; algod remains the final authority.
     */
    isUnderfunded: boolean
}

/**
 * Preflight for the rekey confirm screens: the source account pays the rekey
 * fee, and after paying it its balance must stay at or above the min-balance
 * reserve. Reads the per-network balance row account sync keeps fresh and
 * compares against the fee the screen already displays
 * (`useRekeyTransactionFeeQuery`'s ALGO `Decimal`), so the gate and the
 * displayed fee can never diverge.
 */
export const useRekeyFeePreflight = (
    sourceAddress: string,
    feeAlgos: Decimal | undefined,
): UseRekeyFeePreflightResult => {
    const { data: accountInformation } =
        useAccountInformationQuery(sourceAddress)

    const isUnderfunded = useMemo(() => {
        if (!feeAlgos || !accountInformation) return false
        const spendable =
            accountInformation.amount - accountInformation.minBalance
        return spendable < algosToMicroAlgosBigInt(feeAlgos)
    }, [feeAlgos, accountInformation])

    return { isUnderfunded }
}
