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
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    aggregateTransactionWarnings,
    type TransactionWarning,
} from '@perawallet/wallet-core-signing'

// The history view only surfaces the per-transaction, address-based warnings.
// High fee is a signing-review concern (see useSigningPipeline) and is never
// emitted by the aggregator used here, so it's excluded from this view's type.
type AddressWarning = Extract<TransactionWarning, { senderAddress: string }>

export type AddressWarningType = AddressWarning['type']

type WarningsByType = Record<AddressWarningType, AddressWarning[]>

type UseTransactionWarningsResult = {
    warningCount: number
    warningsByType: WarningsByType
}

export const useTransactionWarnings = (
    transaction: PeraDisplayableTransaction,
): UseTransactionWarningsResult => {
    const allAccounts = useAllAccounts()
    const signingAccounts = useSigningAccounts()

    const userAccountAddresses = useMemo(
        () => new Set(allAccounts.map(a => a.address)),
        [allAccounts],
    )

    const signableAddresses = useMemo(
        () => new Set(signingAccounts.map(a => a.address)),
        [signingAccounts],
    )

    const warnings = useMemo(
        () =>
            aggregateTransactionWarnings(
                [transaction],
                userAccountAddresses,
                signableAddresses,
            ),
        [transaction, userAccountAddresses, signableAddresses],
    )

    const warningsByType: WarningsByType = useMemo(() => {
        const addressWarnings = warnings.filter(
            (w): w is AddressWarning => w.type !== 'high-fee',
        )
        return {
            'close-account': addressWarnings.filter(
                w => w.type === 'close-account',
            ),
            'close-asset': addressWarnings.filter(
                w => w.type === 'close-asset',
            ),
            rekey: addressWarnings.filter(w => w.type === 'rekey'),
            'asset-freeze': addressWarnings.filter(
                w => w.type === 'asset-freeze',
            ),
        }
    }, [warnings])

    return {
        warningCount: warnings.length,
        warningsByType,
    }
}
