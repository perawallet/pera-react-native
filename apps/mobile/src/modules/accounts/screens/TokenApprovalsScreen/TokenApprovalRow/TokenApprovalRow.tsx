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

import type { ReactNode } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWButton, PWText } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { useLanguage } from '@hooks/useLanguage'
import { AssetItemView } from '@modules/assets'
import { useStyles } from './styles'
import type { TokenApprovalItem } from '../useTokenApprovalsScreen'

export type TokenApprovalRowProps = {
    item: TokenApprovalItem
    scope: ChainScope
    canRevoke: boolean
    isRevoking: boolean
    /** Another revoke is waiting on the chain, so this one would conflict with it. */
    isRevokeDisabled: boolean
    onRevoke: (item: TokenApprovalItem) => void
}

export const TokenApprovalRow = ({
    item,
    scope,
    canRevoke,
    isRevoking,
    isRevokeDisabled,
    onRevoke,
}: TokenApprovalRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { approval, asset, amount, isTokenPending, isRevocable } = item
    const isAllowance = approval.kind === 'allowance'
    const contract = isAllowance
        ? approval.assetRef.assetId
        : approval.collection

    const unlimited = (
        <PWText
            variant='caption'
            style={styles.unlimited}
            testID={`token_approval_unlimited_${item.id}`}
        >
            {t('token_approvals.unlimited')}
        </PWText>
    )
    const limited = (
        <AssetAmount
            chainId={scope.chainId}
            asset={asset}
            value={amount}
            showSymbol
        />
    )
    // A collection grants every item, so it has no amount to show. A limited
    // one needs its token for the unit: with no record yet, or none at all,
    // it shows nothing rather than a number in the wrong units.
    let amountLine: ReactNode
    if (isAllowance) {
        if (!amount) amountLine = unlimited
        else if (asset) amountLine = limited
    }
    // Once loading has settled without a record, say why there is no Revoke.
    const isUnavailable = !isRevocable && !isTokenPending
    const footer = (
        <>
            {amountLine}
            {isUnavailable && (
                <PWText
                    variant='caption'
                    style={styles.spender}
                    testID={`token_approval_unavailable_${item.id}`}
                >
                    {t('token_approvals.revoke_unavailable')}
                </PWText>
            )}
        </>
    )

    return (
        <AssetItemView
            asset={
                asset ??
                (isAllowance
                    ? { assetId: contract }
                    : { assetId: contract, name: approval.collectionName })
            }
            chainId={scope.chainId}
            title={
                isAllowance
                    ? undefined
                    : t('token_approvals.all_items', {
                          collection: approval.collectionName ?? contract,
                      })
            }
            subtitle={
                approval.knownSpender ? (
                    <PWText
                        variant='caption'
                        style={styles.spender}
                        numberOfLines={1}
                        testID={`token_approval_spender_${item.id}`}
                    >
                        {approval.knownSpender.name}
                    </PWText>
                ) : (
                    <AddressDisplay
                        address={approval.spender}
                        displayType='address-only'
                        scope={scope}
                    />
                )
            }
            footer={footer}
            right={
                canRevoke ? (
                    <PWButton
                        variant='link'
                        title={t('token_approvals.revoke')}
                        isLoading={isRevoking}
                        isDisabled={isRevokeDisabled || !isRevocable}
                        onPress={() => onRevoke(item)}
                        testID={`token_approval_revoke_${item.id}`}
                    />
                ) : undefined
            }
            style={styles.row}
        />
    )
}
