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

import { useMemo } from 'react'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useSigningAccounts } from '@perawallet/wallet-core-accounts'
import {
    aggregateTransactionWarnings,
    type TransactionWarning,
} from '@perawallet/wallet-core-signing'
import { useModalState } from '@hooks/useModalState'

type TransactionWarningType = TransactionWarning['type']

type WarningsByType = Record<TransactionWarningType, TransactionWarning[]>

type UseTransactionWarningsResult = {
    warningCount: number
    warningsByType: WarningsByType
    isModalOpen: boolean
    openModal: () => void
    closeModal: () => void
}

export const useTransactionWarnings = (
    transaction: PeraDisplayableTransaction,
): UseTransactionWarningsResult => {
    const signingAccounts = useSigningAccounts()
    const { isOpen, open, close } = useModalState()

    const userAccountAddresses = useMemo(
        () => new Set(signingAccounts.map(a => a.address)),
        [signingAccounts],
    )

    const warnings = useMemo(
        () => aggregateTransactionWarnings([transaction], userAccountAddresses),
        [transaction, userAccountAddresses],
    )

    const warningsByType: WarningsByType = {
        close: warnings.filter(w => w.type === 'close'),
        rekey: warnings.filter(w => w.type === 'rekey'),
        'asset-freeze': warnings.filter(w => w.type === 'asset-freeze'),
    }

    return {
        warningCount: warnings.length,
        warningsByType,
        isModalOpen: isOpen,
        openModal: open,
        closeModal: close,
    }
}
