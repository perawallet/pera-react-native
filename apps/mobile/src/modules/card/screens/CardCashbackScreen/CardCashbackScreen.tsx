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

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardCashbackScreen } from './useCardCashbackScreen'
import { useStyles } from './styles'

export const CardCashbackScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        balanceDisplay,
        currencyDisplay,
        isLoading,
        canWithdraw,
        handleWithdraw,
    } = useCardCashbackScreen()

    return (
        <PWScreen
            testID='card-cashback'
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.cashback.withdraw_button')}
                    onPress={handleWithdraw}
                    isDisabled={!canWithdraw || isLoading}
                    testID='card-cashback-withdraw-cta'
                />
            }
        >
            <PWView style={styles.content}>
                <PWText
                    variant='footnoteMedium'
                    style={styles.balanceLabel}
                >
                    {t('peraCard.cashback.balance_label')}
                </PWText>
                <PWText
                    variant='h1'
                    testID='card-cashback-balance'
                >
                    {balanceDisplay} {currencyDisplay}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.body}
                >
                    {canWithdraw
                        ? t('peraCard.cashback.body')
                        : t('peraCard.cashback.not_withdrawable_body')}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
