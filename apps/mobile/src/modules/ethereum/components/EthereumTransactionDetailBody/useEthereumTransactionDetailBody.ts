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
import type {
    ChainScope,
    TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useTransactionHeroTitle,
    type TransactionDetailSummary,
} from '@modules/signing'
import {
    useEthereumTransactionPresentation,
    type EthereumTransactionPresentation,
} from '../../hooks/useEthereumTransactionPresentation'

export type UseEthereumTransactionDetailBodyResult = {
    presentation: Nullable<EthereumTransactionPresentation>
    summary: Nullable<TransactionDetailSummary>
}

export const useEthereumTransactionDetailBody = (
    transaction: TransactionNative,
    scope?: ChainScope,
): UseEthereumTransactionDetailBodyResult => {
    const heroTitle = useTransactionHeroTitle()
    const presentation = useEthereumTransactionPresentation(transaction, scope)

    return useMemo(() => {
        if (!presentation) return { presentation, summary: null }

        const { amount, feePaid, view, isAmountLoading } = presentation
        return {
            presentation,
            summary: {
                scope: presentation.scope,
                iconName: presentation.iconName,
                title: heroTitle({ key: presentation.titleKey }),
                ...('isMined' in view && { status: 'completed' as const }),
                amount: amount?.asset
                    ? { asset: amount.asset, value: amount.value }
                    : undefined,
                isAmountLoading: !amount?.asset && isAmountLoading,
                from: view.from,
                to: presentation.isTransfer
                    ? presentation.counterparty
                    : undefined,
                // Before mining the most it can cost is the max fee, which sits in the section.
                fee: feePaid?.asset
                    ? { asset: feePaid.asset, value: feePaid.value }
                    : undefined,
            },
        }
    }, [presentation, heroTitle])
}
