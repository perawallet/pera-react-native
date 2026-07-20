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

import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { NumberPad } from '@components/NumberPad'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { useLanguage } from '@hooks/useLanguage'
import { CardAmountInput } from '../../components/CardAmountInput'
import { useCardAddFundsScreen } from './useCardAddFundsScreen'
import { useStyles } from './styles'

export const CardAddFundsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        fundingAccount,
        sourceAsset,
        balanceDisplay,
        amount,
        secondaryDisplay,
        rate,
        handleKey,
        onSelectAsset,
        isDepositDisabled,
        isDepositing,
        handleDeposit,
    } = useCardAddFundsScreen()

    return (
        <PWScreen
            scroll='never'
            testID='card-add-funds'
        >
            <PWView style={styles.container}>
                <PWView style={styles.topGroup}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.subtitle}
                    >
                        {t('peraCard.add_funds.subtitle')}
                    </PWText>

                    <PWView style={styles.fundAddressRow}>
                        <PWText
                            variant='body'
                            style={styles.mutedLabel}
                        >
                            {t('peraCard.add_funds.fund_address')}
                        </PWText>
                        <AccountDisplay
                            account={fundingAccount ?? undefined}
                            showChevron={false}
                            noBorder
                            iconProps={{ size: 'sm' }}
                            testID='card-add-funds-fund-address'
                        />
                    </PWView>

                    <CardAmountInput
                        label={t('peraCard.add_funds.amount')}
                        balanceText={t('peraCard.add_funds.balance', {
                            amount: balanceDisplay,
                        })}
                        amount={amount}
                        amountTestID='card-add-funds-amount'
                        chip={
                            <>
                                {sourceAsset && (
                                    <AssetIcon
                                        asset={sourceAsset}
                                        size='sm'
                                    />
                                )}
                                <PWText variant='bodyLarge'>
                                    {sourceAsset?.unitName ?? 'USDC'}
                                </PWText>
                                <PWIcon
                                    name='chevron-right'
                                    variant='secondary'
                                />
                            </>
                        }
                        onChipPress={() => void onSelectAsset()}
                        chipTestID='card-add-funds-asset-selector'
                    >
                        <PWText
                            variant='body'
                            style={styles.mutedLabel}
                        >
                            {secondaryDisplay}
                        </PWText>

                        {!!rate && (
                            <PWView style={styles.rateRow}>
                                <PWIcon
                                    name='swap'
                                    variant='secondary'
                                    size='sm'
                                    style={styles.rateIcon}
                                />
                                <PWText
                                    variant='body'
                                    style={styles.mutedLabel}
                                    testID='card-add-funds-rate'
                                >
                                    {rate}
                                </PWText>
                            </PWView>
                        )}
                    </CardAmountInput>
                </PWView>

                <PWView style={styles.bottomGroup}>
                    <PWButton
                        variant='primary'
                        title={t('peraCard.add_funds.deposit')}
                        onPress={handleDeposit}
                        isDisabled={isDepositDisabled}
                        isLoading={isDepositing}
                        testID='card_add_funds_deposit_button'
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
