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

import { useCallback } from 'react'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { hasEvmApprovalsService } from '@perawallet/wallet-core-chain-ethereum'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'

export type UseEthereumMinedApprovalResult = {
    /** Null for a call that grants nothing, such as a revocation. */
    grantText: Optional<string>
    /** Unset where the account's approvals can't be listed: no account, or a scope Pera serves no approvals for. */
    handleOpenTokenApprovals: Optional<() => void>
}

/** What a mined approval granted, said as done rather than warned of, as the review before signing did. */
export const useEthereumMinedApproval = ({
    standardCall,
    signingAccount,
    scope,
}: EthereumTransactionPresentation): UseEthereumMinedApprovalResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    // The capability is on for every EVM chain, but a scope Pera serves no
    // approvals for opens a screen that can only say so.
    const canListApprovals =
        useCapability({
            chain: { chainId: scope.chainId, capability: 'tokenApprovals' },
        }) && hasEvmApprovalsService(scope)
    const nameOf = (spender: string, knownName?: string) =>
        knownName ?? addressCodecs.get(scope.chainId).truncate(spender)

    let grantText: Optional<string>
    if (standardCall?.kind === 'token-approval' && standardCall.spendApproval) {
        const { spender, knownSpender, allowances } = standardCall.spendApproval
        const isUnlimited = allowances.some(({ amount }) => !amount)
        grantText = t(
            isUnlimited
                ? 'transactions.record_detail.approval_granted_unlimited'
                : 'transactions.record_detail.approval_granted',
            { spender: nameOf(spender, knownSpender?.name) },
        )
    } else if (
        standardCall?.kind === 'collection-approval' &&
        standardCall.isApproved
    ) {
        grantText = t(
            'transactions.record_detail.collection_approval_granted',
            {
                spender: nameOf(standardCall.operator),
            },
        )
    }

    const accountId = signingAccount?.id
    const handleOpenTokenApprovals = useCallback(() => {
        if (accountId) {
            navigation.navigate('TokenApprovals', { accountId, scope })
        }
    }, [navigation, accountId, scope])

    return {
        grantText,
        handleOpenTokenApprovals:
            grantText && accountId && canListApprovals
                ? handleOpenTokenApprovals
                : undefined,
    }
}
