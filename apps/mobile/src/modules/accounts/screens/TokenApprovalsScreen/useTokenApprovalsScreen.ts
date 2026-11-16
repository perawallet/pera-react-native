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

import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { Decimal } from 'decimal.js'
import {
    addressOn,
    useAllAccounts,
    useCanSignWith,
} from '@perawallet/wallet-core-accounts'
import {
    toWholeUnits,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type {
    ChainScope,
    TokenApproval,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import {
    useRevokeTokenApprovalMutation,
    useTokenApprovalsQuery,
} from '@perawallet/wallet-core-transactions'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { AccountStackParamsList } from '../../routes/types'

export type TokenApprovalItem = {
    /** The token or collection and the spender, lowercased. */
    id: string
    approval: TokenApproval
    /** The token's record, when the store can read it; always null for a collection. */
    asset: Nullable<PeraAsset>
    /** The token's record is still loading, so its amount can't be shown in its units yet. */
    isTokenPending: boolean
    /**
     * Review reads `approve(spender, 0)` as a revoke only once it has the
     * token's record; without one it shows a zero grant, so an allowance with
     * no record can't be revoked from here. A collection never needs one.
     */
    isRevocable: boolean
    /** Display units of `asset`, or base units when `asset` is null; null when unlimited or for a collection. */
    amount: Nullable<Decimal>
}

export type UseTokenApprovalsScreenResult = {
    scope: ChainScope
    items: TokenApprovalItem[]
    isPending: boolean
    isError: boolean
    /** A watch account's list is shown, but it holds no key to revoke with. */
    canRevoke: boolean
    revokingId: Nullable<string>
    handleRevoke: (item: TokenApprovalItem) => void
    handleRetry: () => void
}

// Base units, converted only once the token's decimals are known.
const displayAmountOf = (
    base: Optional<Decimal>,
    asset: Nullable<PeraAsset>,
): Nullable<Decimal> => {
    if (!base) return null
    return asset ? toWholeUnits(base, asset) : base
}

const approvalIdOf = (approval: TokenApproval): string =>
    `${approval.kind === 'allowance' ? approval.assetRef.assetId : approval.collection}:${approval.spender}`.toLowerCase()

export const useTokenApprovalsScreen = (): UseTokenApprovalsScreenResult => {
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { accountId, scope } =
        useRoute<RouteProp<AccountStackParamsList, 'TokenApprovals'>>().params
    const accounts = useAllAccounts()
    const account = accounts.find(candidate => candidate.id === accountId)
    const address = account ? addressOn(account, scope) : undefined
    const canRevoke = useCanSignWith(account, scope.chainId)

    const approvals = useTokenApprovalsQuery({ scope, account: address })
    const { revoke, revokingApproval } = useRevokeTokenApprovalMutation(
        address ? { scope, account: address } : undefined,
    )

    const assetIds = useMemo(
        () =>
            approvals.data.flatMap(approval =>
                approval.kind === 'allowance'
                    ? [approval.assetRef.assetId]
                    : [],
            ),
        [approvals.data],
    )
    const { data: assets, isPending: isAssetsQueryPending } = useAssetsQuery(
        scope,
        assetIds,
        {
            fetchMissing: true,
        },
    )

    const items = useMemo(
        () =>
            approvals.data.map((approval): TokenApprovalItem => {
                const asset =
                    approval.kind === 'allowance'
                        ? (assets.get(approval.assetRef.assetId) ?? null)
                        : null
                const base =
                    approval.kind === 'allowance' ? approval.amount : undefined
                return {
                    id: approvalIdOf(approval),
                    approval,
                    asset,
                    isTokenPending:
                        approval.kind === 'allowance' &&
                        !asset &&
                        isAssetsQueryPending,
                    isRevocable: approval.kind === 'collection' || !!asset,
                    amount: displayAmountOf(base, asset),
                }
            }),
        [approvals.data, assets, isAssetsQueryPending],
    )

    const handleRevoke = useCallback(
        (item: TokenApprovalItem) => {
            if (!address) return
            revoke({ scope, account: address, approval: item.approval }).catch(
                (error: unknown) => {
                    if (error instanceof UserRejectedSigningError) return
                    errorToast(
                        t('token_approvals.revoke_error_title'),
                        t('token_approvals.revoke_error_body'),
                    )
                },
            )
        },
        [address, revoke, scope, errorToast, t],
    )

    return {
        scope,
        items,
        isPending: approvals.isPending,
        isError: approvals.isError,
        canRevoke,
        revokingId: revokingApproval ? approvalIdOf(revokingApproval) : null,
        handleRevoke,
        handleRetry: approvals.refetch,
    }
}
