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
import {
    classifyDisplayableTransaction,
    encodeAlgorandAddress,
    type AlgorandTransactionKind,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useBalanceImpactSummary,
    type UseBalanceImpactSummaryResult,
} from '@modules/signing'
import { algorandTransactionIconName } from '@modules/algorand/icons'

export type AlgorandReviewTarget =
    | { kind: 'address'; address: string }
    | { kind: 'application'; applicationId: string }
    | { kind: 'asset'; label: string }

export type UseAlgorandTransactionReviewResult = {
    scope: ChainScope
    kind: AlgorandTransactionKind
    iconName: IconName
    title: string
    target: Optional<AlgorandReviewTarget>
    signingAccount: Nullable<WalletAccount>
    /** The expected balance impact, worked out from the transaction itself. */
    impact: UseBalanceImpactSummaryResult
}

const TITLE_KEYS: Record<AlgorandTransactionKind, string> = {
    payment: 'transactions.list_item.send',
    'asset-transfer': 'transactions.list_item.send',
    'asset-opt-in': 'transactions.list_item.opt_in',
    'asset-opt-out': 'transactions.list_item.opt_out',
    'asset-clawback': 'signing.review.title_clawback',
    'asset-config': 'transactions.list_item.asset_config',
    'asset-freeze': 'transactions.list_item.asset_freeze',
    'key-registration': 'transactions.list_item.key_registration',
    'app-call': 'transactions.list_item.app_call',
    'state-proof': 'transactions.list_item.state_proof',
    heartbeat: 'transactions.list_item.heartbeat',
    unknown: 'transactions.list_item.default',
}

export const useAlgorandTransactionReview = (
    view: AlgorandTransactionView,
): UseAlgorandTransactionReviewResult => {
    const { t } = useLanguage()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const kind = classifyDisplayableTransaction(view)
    const impact = useBalanceImpactSummary()
    const authAddress = view.authAddr?.publicKey
        ? encodeAlgorandAddress(view.authAddr.publicKey)
        : view.sender
    const signingAccount = useFindAccountByAddress(authAddress, scope)
    const assetId = view.assetTransferTransaction?.assetId?.toString() ?? ''
    const { data: asset } = useSingleAssetDetailsQuery(assetId, scope)

    const target = useMemo((): Optional<AlgorandReviewTarget> => {
        switch (kind) {
            case 'payment': {
                const receiver = view.paymentTransaction?.receiver
                return receiver
                    ? { kind: 'address', address: receiver }
                    : undefined
            }
            case 'asset-opt-in':
            case 'asset-opt-out': {
                return {
                    kind: 'asset',
                    label: asset?.unitName ?? asset?.name ?? assetId,
                }
            }
            case 'asset-transfer':
            case 'asset-clawback': {
                const receiver = view.assetTransferTransaction?.receiver
                return receiver
                    ? { kind: 'address', address: receiver }
                    : undefined
            }
            case 'app-call': {
                const applicationId =
                    view.applicationTransaction?.applicationId?.toString()
                return applicationId
                    ? { kind: 'application', applicationId }
                    : undefined
            }
            default: {
                return undefined
            }
        }
    }, [kind, view, asset, assetId])

    return {
        scope,
        kind,
        iconName: algorandTransactionIconName(kind),
        title: t(TITLE_KEYS[kind]),
        target,
        signingAccount: signingAccount ?? null,
        impact,
    }
}
