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

import { type Decimal } from 'decimal.js'
import {
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import peraCardImage from '@assets/images/pera-card.png'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PeraCardBalanceSectionProps = {
    balance: Decimal
    currency: string
    isAutoFunding: boolean
    onFundingPress: () => void
}

export const PeraCardBalanceSection = ({
    balance,
    currency,
    isAutoFunding,
    onFundingPress,
}: PeraCardBalanceSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.balanceBlock}>
            <PWView style={styles.balanceLabelRow}>
                <PWImage
                    source={peraCardImage}
                    style={styles.balanceCardIcon}
                    resizeMode='contain'
                />
                <PWText
                    variant='footnoteMedium'
                    style={styles.balanceLabel}
                >
                    {t('peraCard.account.balance')}
                </PWText>
            </PWView>

            <CurrencyAmount
                value={balance}
                currency={currency}
                precision='compact'
                symbolPosition='end'
                variant='h1'
            />

            <PWTouchableOpacity
                style={styles.fundingRow}
                onPress={onFundingPress}
                hitSlop={8}
                testID='pera_card_funding_row'
            >
                <PWView style={styles.fundingTextGroup}>
                    <PWIcon
                        name='buy-sell'
                        size='sm'
                        variant='secondary'
                    />
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.fundingLabel}
                    >
                        {isAutoFunding
                            ? t('peraCard.account.auto_funding_enabled')
                            : t('peraCard.account.manual_funding_enabled')}
                    </PWText>
                </PWView>
                <PWIcon
                    name='chevron-right'
                    size='sm'
                    variant='secondary'
                />
            </PWTouchableOpacity>
        </PWView>
    )
}
