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

import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { NumberPad } from '@components/NumberPad'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { CardAmountInput } from '../../components/CardAmountInput'
import { useCardWithdrawScreen } from './useCardWithdrawScreen'
import { useStyles } from './styles'

export const CardWithdrawScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        destinationAccount,
        balanceDisplay,
        amount,
        handleKey,
        isWithdrawDisabled,
        onWithdraw,
    } = useCardWithdrawScreen()

    return (
        <PWScreen scroll='never'>
            <PWView style={styles.container}>
                <PWView style={styles.topGroup}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.subtitle}
                    >
                        {t('peraCard.withdraw.subtitle')}
                    </PWText>

                    <PWView style={styles.toAccountRow}>
                        <PWText
                            variant='body'
                            style={styles.mutedLabel}
                        >
                            {t('peraCard.withdraw.to_account')}
                        </PWText>
                        <AccountDisplay
                            account={destinationAccount ?? undefined}
                            showChevron={false}
                            noBorder
                            iconProps={{ size: 'sm' }}
                            testID='card-withdraw-to-account'
                        />
                    </PWView>

                    <CardAmountInput
                        label={t('peraCard.withdraw.amount')}
                        balanceText={t('peraCard.withdraw.balance', {
                            amount: balanceDisplay,
                        })}
                        amount={amount}
                        amountTestID='card-withdraw-amount'
                        chip={<PWText variant='bodyLarge'>USDC</PWText>}
                    />
                </PWView>

                <PWView style={styles.bottomGroup}>
                    <PWButton
                        variant='primary'
                        title={t('peraCard.withdraw.withdraw')}
                        onPress={onWithdraw}
                        isDisabled={isWithdrawDisabled}
                        testID='card_withdraw_button'
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
