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

import type { TFunction } from 'i18next'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { AssetIcon } from '@components/AssetIcon'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumPermission } from '../ethereumPermissions'
import { useStyles } from './styles'

// What a permission covers, when it is not a plain amount.
const grantLabelOf = (
    permission: EthereumPermission,
    symbol: string,
    t: TFunction,
): string => {
    const { grant } = permission
    if (grant.kind === 'token') {
        return t('signing.review.permission_token', {
            collection: symbol,
            tokenId: grant.tokenId,
        })
    }
    if (grant.kind !== 'unlimited') return symbol
    return permission.isCollectionWide
        ? t('signing.review.permission_collection', { collection: symbol })
        : t('signing.review.permission_unlimited', { symbol })
}

export type EthereumPermissionCardProps = {
    scope: ChainScope
    permissions: readonly EthereumPermission[]
    /** Nothing leaves the wallet, so the card says the permission is all the transaction does. */
    isOnlyPermission: boolean
}

export const EthereumPermissionCard = ({
    scope,
    permissions,
    isOnlyPermission,
}: EthereumPermissionCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const shortAddress = (address: string) =>
        addressCodecs.has(scope.chainId)
            ? addressCodecs.get(scope.chainId).truncate(address)
            : address

    return (
        <PWView
            style={styles.card}
            testID='ethereum_review_permission'
        >
            <PWText
                variant='bodySemibold'
                style={styles.heading}
            >
                {t('signing.review.permission_title')}
            </PWText>
            {permissions.map(permission => {
                const spender =
                    permission.spenderName ?? shortAddress(permission.spender)
                const symbol =
                    permission.asset?.unitName ??
                    permission.collectionName ??
                    shortAddress(permission.contract)
                const { grant } = permission
                const isUnlimited = grant.kind === 'unlimited'
                return (
                    <PWView
                        key={permission.key}
                        style={styles.permission}
                    >
                        <PWView style={styles.row}>
                            {permission.asset ? (
                                <AssetIcon
                                    chainId={scope.chainId}
                                    asset={permission.asset}
                                    size='lg'
                                />
                            ) : (
                                <PWView style={styles.placeholderIcon}>
                                    <PWIcon
                                        name='key'
                                        size='sm'
                                        variant='secondary'
                                    />
                                </PWView>
                            )}
                            <PWView style={styles.info}>
                                <PWView style={styles.spenderRow}>
                                    <PWText
                                        style={styles.spender}
                                        numberOfLines={1}
                                    >
                                        {t(
                                            grant.kind === 'revoke'
                                                ? 'signing.review.permission_revoke'
                                                : 'signing.review.permission_spender',
                                            { spender },
                                        )}
                                    </PWText>
                                    {!!permission.spenderName && (
                                        <PWIcon
                                            name='check'
                                            size='xs'
                                            variant='positive'
                                        />
                                    )}
                                </PWView>
                                {grant.kind === 'amount' ? (
                                    <AssetAmount
                                        chainId={scope.chainId}
                                        asset={
                                            grant.isBaseUnits
                                                ? null
                                                : permission.asset
                                        }
                                        value={grant.amount}
                                        variant='h3'
                                        weight={600}
                                        style={styles.amount}
                                        numberOfLines={1}
                                        testID='ethereum_review_permission_amount'
                                    />
                                ) : (
                                    <PWText
                                        variant='h3'
                                        weight={600}
                                        style={styles.amount}
                                        numberOfLines={1}
                                        testID='ethereum_review_permission_amount'
                                    >
                                        {grantLabelOf(permission, symbol, t)}
                                    </PWText>
                                )}
                            </PWView>
                        </PWView>
                        {isUnlimited && (
                            <PWView
                                style={styles.unlimitedNote}
                                testID='ethereum_review_permission_unlimited'
                            >
                                <PWIcon
                                    name='warning'
                                    size='sm'
                                    variant='warning'
                                    style={styles.unlimitedIcon}
                                />
                                <PWText style={styles.unlimitedText}>
                                    {t(
                                        permission.isCollectionWide
                                            ? 'signing.review.permission_collection_note'
                                            : 'signing.review.permission_unlimited_note',
                                        { symbol },
                                    )}
                                </PWText>
                            </PWView>
                        )}
                    </PWView>
                )
            })}
            {isOnlyPermission && (
                <PWView style={styles.footer}>
                    <PWIcon
                        name='check'
                        size='xs'
                        variant='secondary'
                    />
                    <PWText
                        variant='caption'
                        style={styles.footerText}
                    >
                        {t('signing.review.permission_no_change')}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
