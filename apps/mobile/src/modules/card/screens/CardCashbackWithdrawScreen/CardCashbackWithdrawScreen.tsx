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
import { NumberPad } from '@components/NumberPad'
import { useLanguage } from '@hooks/useLanguage'
import { CardAmountInput } from '../../components/CardAmountInput'
import { useCardCashbackWithdrawScreen } from './useCardCashbackWithdrawScreen'
import { useStyles } from './styles'

export const CardCashbackWithdrawScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        balanceDisplay,
        amount,
        handleKey,
        isWithdrawDisabled,
        onWithdraw,
    } = useCardCashbackWithdrawScreen()

    return (
        <PWScreen
            scroll='never'
            testID='card-cashback-withdraw'
        >
            <PWView style={styles.container}>
                <PWView style={styles.topGroup}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.subtitle}
                    >
                        {t('peraCard.cashback.withdraw_subtitle')}
                    </PWText>

                    <CardAmountInput
                        label={t('peraCard.cashback.amount')}
                        balanceText={t('peraCard.cashback.balance', {
                            amount: balanceDisplay,
                        })}
                        amount={amount}
                        amountTestID='card-cashback-withdraw-amount'
                        chip={<PWText variant='bodyLarge'>USDC</PWText>}
                    />
                </PWView>

                <PWView style={styles.bottomGroup}>
                    <PWButton
                        variant='primary'
                        title={t('peraCard.cashback.withdraw_button')}
                        onPress={onWithdraw}
                        isDisabled={isWithdrawDisabled}
                        testID='card_cashback_withdraw_button'
                    />
                    <NumberPad
                        onPress={handleKey}
                        allowDecimal
                    />
                </PWView>
            </PWView>
        </PWScreen>
    )
}
