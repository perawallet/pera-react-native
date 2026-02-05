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
import {
    type PeraDisplayableTransaction,
    mapToDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import type { TransactionSignRequest } from '../models'
import { calculateTotalFee } from '../utils/fees'
import { aggregateTransactionWarnings } from '../utils/warnings'
import { classifyTransactionGroups } from '../utils/classification'
import { encodeToBase64, partitionBy } from '@perawallet/wallet-core-shared'

export const useSigningRequestAnalysis = (request: TransactionSignRequest) => {
    const accounts = useAllAccounts()

    const groups = useMemo(
        () =>
            partitionBy(
                request.txs
                    .map(tx => mapToDisplayableTransaction(tx))
                    .filter((tx): tx is PeraDisplayableTransaction => !!tx),
                (tx: PeraDisplayableTransaction) =>
                    tx.group ? encodeToBase64(tx.group) : 'no-group',
            ),
        [request.txs],
    )

    const allTransactions = useMemo(() => groups.flat(), [groups])

    const signableAddresses = useMemo(
        () => new Set(accounts.filter(a => a.canSign).map(a => a.address)),
        [accounts],
    )

    const totalFee = useMemo(
        () => calculateTotalFee(allTransactions, signableAddresses),
        [allTransactions, signableAddresses],
    )

    const warnings = useMemo(
        () => aggregateTransactionWarnings(allTransactions, signableAddresses),
        [allTransactions, signableAddresses],
    )

    const distinctWarnings = useMemo(
        () =>
            warnings.filter(
                (warning, index) =>
                    warnings.findIndex(w => w.type === warning.type) === index,
            ),
        [warnings],
    )

    const requestStructure = useMemo(
        () => classifyTransactionGroups(groups),
        [groups],
    )

    return {
        groups,
        allTransactions,
        totalFee,
        warnings,
        distinctWarnings,
        requestStructure,
    }
}
