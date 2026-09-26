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

import type { Decimal } from 'decimal.js'
import { CardWalletKind } from '@perawallet/wallet-core-chain-algorand/card'
import { PWIcon, PWListItemLayout, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { PeraCardCredits } from './usePeraCardOverview'
import { useStyles } from './styles'

type PeraCardCreditsSectionProps = {
    credits: PeraCardCredits
    currency: string
    onCreditPress: (kind: CardWalletKind) => void
}

export const PeraCardCreditsSection = ({
    credits,
    currency,
    onCreditPress,
}: PeraCardCreditsSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWText variant='h4'>{t('peraCard.account.credits_title')}</PWText>
            <PWText
                variant='footnoteMedium'
                style={styles.sectionDescription}
            >
                {t('peraCard.account.credits_description')}
            </PWText>
            <PWView style={styles.rowGroup}>
                <CreditRow
                    kind={CardWalletKind.Reward}
                    label={t('peraCard.account.rewards')}
                    amount={credits.rewards}
                    currency={currency}
                    onPress={onCreditPress}
                    testID='pera_card_rewards_row'
                />
                <CreditRow
                    kind={CardWalletKind.Credit}
                    label={t('peraCard.account.refunds')}
                    amount={credits.refunds}
                    currency={currency}
                    onPress={onCreditPress}
                    testID='pera_card_refunds_row'
                />
            </PWView>
        </PWView>
    )
}

type CreditRowProps = {
    kind: CardWalletKind
    label: string
    amount: Decimal
    currency: string
    onPress: (kind: CardWalletKind) => void
    testID: string
}

const CreditRow = ({
    kind,
    label,
    amount,
    currency,
    onPress,
    testID,
}: CreditRowProps) => {
    const styles = useStyles()

    return (
        <PWListItemLayout
            style={styles.cardRow}
            onPress={() => onPress(kind)}
            testID={testID}
            right={
                <PWView style={styles.rowRight}>
                    <CurrencyAmount
                        value={amount}
                        currency={currency}
                        assetId={null}
                        precision='compact'
                        symbolPosition='end'
                        variant='bodyLarge'
                        weight={500}
                        style={styles.rowValue}
                    />
                    <PWIcon
                        name='chevron-right'
                        size='sm'
                        variant='secondary'
                    />
                </PWView>
            }
        >
            <PWText
                variant='bodyLarge'
                weight={400}
            >
                {label}
            </PWText>
        </PWListItemLayout>
    )
}
