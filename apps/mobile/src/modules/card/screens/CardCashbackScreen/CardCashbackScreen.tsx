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

import {
    PWButton,
    PWIcon,
    PWImage,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import cashbackHero from '@assets/images/cashback-hero.png'
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
        isError,
        hasBalance,
        canWithdraw,
        handleWithdraw,
        refetch,
    } = useCardCashbackScreen()

    return (
        <PWScreen
            testID='card-cashback'
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.cashback.claim_button')}
                    onPress={handleWithdraw}
                    isDisabled={!canWithdraw}
                    testID='card-cashback-withdraw-cta'
                />
            }
        >
            <PWView style={styles.content}>
                <PWView style={styles.heroSection}>
                    <PWView
                        style={styles.artwork}
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility='no-hide-descendants'
                    >
                        <PWImage
                            source={cashbackHero}
                            style={styles.hero}
                            resizeMode='contain'
                            showLoadingIndicator={false}
                        />
                    </PWView>
                    <PWView style={styles.balanceSection}>
                        <PWText
                            variant='footnoteMedium'
                            style={styles.secondaryText}
                        >
                            {t('peraCard.cashback.balance_label')}
                        </PWText>
                        {isError ? (
                            <PWView style={styles.status}>
                                <PWText
                                    variant='body'
                                    style={styles.centeredText}
                                >
                                    {t('peraCard.cashback.error_body')}
                                </PWText>
                                <PWButton
                                    variant='link'
                                    title={t('peraCard.cashback.retry')}
                                    onPress={refetch}
                                    testID='card-cashback-retry'
                                />
                            </PWView>
                        ) : isLoading || balanceDisplay === null ? (
                            <PWSkeleton style={styles.balanceSkeleton} />
                        ) : (
                            <>
                                <PWText
                                    variant='h1'
                                    style={styles.balance}
                                    testID='card-cashback-balance'
                                >
                                    {balanceDisplay}{' '}
                                    <PWText
                                        variant='h3'
                                        style={styles.secondaryText}
                                    >
                                        {currencyDisplay}
                                    </PWText>
                                </PWText>
                                <PWView style={styles.status}>
                                    {!hasBalance && (
                                        <PWText
                                            variant='h3'
                                            style={styles.centeredText}
                                        >
                                            {t('peraCard.cashback.empty_title')}
                                        </PWText>
                                    )}
                                    <PWText
                                        variant='body'
                                        style={styles.centeredText}
                                    >
                                        {!hasBalance
                                            ? t('peraCard.cashback.empty_body')
                                            : canWithdraw
                                              ? t('peraCard.cashback.body')
                                              : t(
                                                    'peraCard.cashback.not_withdrawable_body',
                                                )}
                                    </PWText>
                                </PWView>
                            </>
                        )}
                    </PWView>
                </PWView>

                <PWView style={styles.guide}>
                    <PWText variant='h4'>
                        {t('peraCard.cashback.how_title')}
                    </PWText>
                    <PWView style={styles.guideRow}>
                        <PWView style={styles.iconContainer}>
                            <PWIcon name='card' />
                        </PWView>
                        <PWView style={styles.guideText}>
                            <PWText variant='bodySemibold'>
                                {t('peraCard.cashback.earn_title')}
                            </PWText>
                            <PWText
                                variant='bodyCompact'
                                style={styles.secondaryText}
                            >
                                {t('peraCard.cashback.earn_body')}
                            </PWText>
                        </PWView>
                    </PWView>
                    <PWView style={styles.guideRow}>
                        <PWView style={styles.iconContainer}>
                            <PWIcon name='wallet' />
                        </PWView>
                        <PWView style={styles.guideText}>
                            <PWText variant='bodySemibold'>
                                {t('peraCard.cashback.redeem_title')}
                            </PWText>
                            <PWText
                                variant='bodyCompact'
                                style={styles.secondaryText}
                            >
                                {t('peraCard.cashback.redeem_body')}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
