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

import { useCallback, useMemo, useState } from 'react'
import type { Decimal } from 'decimal.js'
import {
    useAccountsStore,
    useAccountValueTotalsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useFundedAccountsRequiringMnemonicBackupQuery } from '@perawallet/wallet-core-backup'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type ConfirmTurnOffBackupResult =
    | { kind: 'turnOff' }
    | { kind: 'backUpFirst'; account: WalletAccount }

type UseConfirmTurnOffBackupSheetResult = {
    isAcknowledged: boolean
    toggleAcknowledged: () => void
    isTurnOffDisabled: boolean
    accountsAtRisk: WalletAccount[]
    /** In the preferred currency's display units; `null` while unknown. */
    accountsAtRiskPreferredValue: Nullable<Decimal>
    handleTurnOff: () => void
    handleBackUpFirst: () => void
    handleCancel: () => void
}

export const useConfirmTurnOffBackupSheet = (
    isAcknowledgementRequired: boolean,
): UseConfirmTurnOffBackupSheetResult => {
    const { resolve, dismiss } =
        useBottomSheetResult<ConfirmTurnOffBackupResult>()
    const scope = useHomeChainScope()
    const accounts = useAccountsStore(state => state.accounts)
    const { accounts: accountsAtRisk, isPending } =
        useFundedAccountsRequiringMnemonicBackupQuery(accounts, scope)
    const { portfolioFiatValue } = useAccountValueTotalsQuery(
        accountsAtRisk,
        scope,
        accountsAtRisk.length > 0,
    )
    const { usdToPreferred } = useCurrency(scope)
    const accountsAtRiskPreferredValue = useMemo(
        () => usdToPreferred(portfolioFiatValue),
        [portfolioFiatValue, usdToPreferred],
    )
    const [isAcknowledged, setIsAcknowledged] = useState(false)

    const toggleAcknowledged = useCallback(
        () => setIsAcknowledged(value => !value),
        [],
    )
    const handleTurnOff = useCallback(
        () => resolve({ kind: 'turnOff' }),
        [resolve],
    )
    const firstAtRisk = accountsAtRisk[0]
    const handleBackUpFirst = useCallback(() => {
        if (!firstAtRisk) return
        resolve({ kind: 'backUpFirst', account: firstAtRisk })
    }, [resolve, firstAtRisk])

    return {
        isAcknowledged,
        toggleAcknowledged,
        isTurnOffDisabled:
            (isAcknowledgementRequired && !isAcknowledged) || isPending,
        accountsAtRisk,
        accountsAtRiskPreferredValue,
        handleTurnOff,
        handleBackUpFirst,
        handleCancel: dismiss,
    }
}
