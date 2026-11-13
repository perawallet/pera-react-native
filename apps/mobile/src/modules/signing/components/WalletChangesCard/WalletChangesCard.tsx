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

import { Fragment } from 'react'
import { PWIcon, PWLoadingIndicator, PWText, PWView } from '@components/core'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { BalanceImpactItem } from '../BalanceImpactSummary'
import { WalletChangeRow } from './WalletChangeRow'
import { useStyles } from './styles'
import { useWalletChangesCard } from './useWalletChangesCard'

export type WalletChangesCardProps = {
    spend: readonly BalanceImpactItem[]
    receive: readonly BalanceImpactItem[]
    /** Shown in place of the rows while the changes are still being worked out. */
    isLoading?: boolean
}

export const WalletChangesCard = ({
    spend,
    receive,
    isLoading = false,
}: WalletChangesCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { netChange, isNetNeutral } = useWalletChangesCard(spend, receive)

    const sideOf = (
        items: readonly BalanceImpactItem[],
        label: string,
        testID: string,
    ) =>
        items.length === 0 ? (
            <WalletChangeRow
                label={label}
                testID={`${testID}_nothing`}
            />
        ) : (
            items.map(item => (
                <Fragment key={`${testID}-${item.assetId}`}>
                    <WalletChangeRow
                        label={label}
                        item={item}
                        testID={`${testID}_${item.assetId}`}
                    />
                </Fragment>
            ))
        )

    if (isLoading) {
        return (
            <PWView
                style={[styles.card, styles.loading]}
                testID='review_wallet_changes_loading'
            >
                <PWLoadingIndicator size='sm' />
                <PWText style={styles.muted}>
                    {t('signing.review.analyzing')}
                </PWText>
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.card}
            testID='review_wallet_changes'
        >
            <PWText
                variant='bodySemibold'
                style={styles.heading}
            >
                {t('signing.review.changes_title')}
            </PWText>
            {sideOf(spend, t('signing.review.you_send'), 'review_wallet_send')}
            <PWView style={styles.arrow}>
                <PWIcon
                    name='arrow-down'
                    size='xs'
                    variant='secondary'
                />
            </PWView>
            {sideOf(
                receive,
                t('signing.review.you_receive'),
                'review_wallet_receive',
            )}
            {netChange && (
                <PWView
                    style={styles.net}
                    testID='review_wallet_net_change'
                >
                    <PWText style={styles.muted}>
                        {t('signing.review.net_change')}
                    </PWText>
                    {isNetNeutral ? (
                        <PWText variant='bodySemibold'>
                            {t('signing.review.net_change_same')}
                        </PWText>
                    ) : (
                        <PreferredAmount
                            value={netChange.abs()}
                            prefix={netChange.isNegative() ? '≈ −' : '≈ +'}
                            variant='bodySemibold'
                        />
                    )}
                </PWView>
            )}
            <PWView style={styles.note}>
                <PWIcon
                    name='info'
                    size='xs'
                    variant='secondary'
                    style={styles.noteIcon}
                />
                <PWText
                    variant='captionMedium'
                    weight={400}
                    style={styles.noteText}
                >
                    {t('signing.review.changes_note')}
                </PWText>
            </PWView>
        </PWView>
    )
}
