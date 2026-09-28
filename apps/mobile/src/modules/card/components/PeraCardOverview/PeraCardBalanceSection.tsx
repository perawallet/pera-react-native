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
import { PWImage, PWSkeleton, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import peraCardImage from '@assets/images/pera-card.png'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

const BALANCE_SKELETON_WIDTH = 160
const BALANCE_SKELETON_HEIGHT = 34

type PeraCardBalanceSectionProps = {
    /** On-card balance, plus the linked account's balance when auto-funding. */
    balance: Decimal
    /** True while the balances are still being fetched. */
    isLoading: boolean
    currency: string
}

export const PeraCardBalanceSection = ({
    balance,
    isLoading,
    currency,
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

            {isLoading ? (
                <PWSkeleton
                    width={BALANCE_SKELETON_WIDTH}
                    height={BALANCE_SKELETON_HEIGHT}
                />
            ) : (
                <CurrencyAmount
                    value={balance}
                    currency={currency}
                    assetId={null}
                    precision='compact'
                    symbolPosition='end'
                    variant='h1'
                />
            )}
        </PWView>
    )
}
